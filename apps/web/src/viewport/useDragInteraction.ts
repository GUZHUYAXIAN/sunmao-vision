/**
 * useDragInteraction.ts — 3D 货物拖拽交互 Hook
 *
 * 双轨制策略（来自迁移文档 §2 + §9）：
 *   - 拖拽中 (60fps): 直接操作 Three.js mesh，零 React 重渲染
 *   - 松手后: 将 mesh 归位到 solver 决定的位置（探索性拖拽）
 *
 * 碰撞检测: 使用 @sunmao/solver 的 aabbIntersects 纯函数（AABB 算法）
 * 网格吸附: 以 GRID_SNAP_MM 为步长吸附到物理网格
 * 坐标系:  所有 dragPlane / AABB 运算均在世界坐标系中完成
 */

import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { makeAabb, aabbIntersects } from '@sunmao/solver';
import type { Aabb } from '@sunmao/solver';

/** 网格吸附步长（mm） */
const GRID_SNAP_MM = 50;

/** 拖拽判定阈值（屏幕像素），防止把点击误判为拖拽 */
const DRAG_THRESHOLD_PX = 5;

const EMISSIVE_VALID = new THREE.Color(0x001a44);
const EMISSIVE_COLLIDE = new THREE.Color(0x550000);
const EMISSIVE_RESET = new THREE.Color(0x000000);

// ─────────────────────────────────────────────────────────────
// 内部类型
// ─────────────────────────────────────────────────────────────

interface DragSession {
  /** 携带 isCargo userData 的货物 Mesh */
  cargoMesh: THREE.Mesh;
  /** userData.cargoId */
  cargoId: string;
  /** 拖拽开始时在父坐标系下的位置（用于松手归位） */
  startLocalPosition: THREE.Vector3;
  /** 拖拽平面到 Mesh 中心的 XZ 偏移（世界坐标系） */
  dragOffset: THREE.Vector3;
  /** Y 轴锁定的水平拖拽平面（世界坐标系） */
  dragPlane: THREE.Plane;
  /** 基于 Box3 算出的 AABB 半尺寸（世界坐标系，mm） */
  halfExtents: THREE.Vector3;
  /** 上一次无碰撞的世界坐标位置 */
  lastValidWorldPos: THREE.Vector3;
  /** 鼠标按下时的屏幕坐标（用于阈值判断） */
  pointerStart: { x: number; y: number };
  /** 是否已超过拖拽阈值 */
  hasExceededThreshold: boolean;
  /** 当前是否处于碰撞状态 */
  isColliding: boolean;
  /** 父节点（用于坐标转换） */
  parent: THREE.Object3D;
}

// ─────────────────────────────────────────────────────────────
// 纯工具函数
// ─────────────────────────────────────────────────────────────

function computeNDC(event: PointerEvent, domElement: HTMLElement): THREE.Vector2 {
  const rect = domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
}

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SNAP_MM) * GRID_SNAP_MM;
}

/** 收集场景中排除指定货物后的所有 AABB（世界坐标系） */
function gatherOtherCargoAabbs(containerGroup: THREE.Group, excludeCargoId: string): Aabb[] {
  const result: Aabb[] = [];
  const box3 = new THREE.Box3();

  containerGroup.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (!obj.userData?.isCargo || obj.userData?.isStaging) return;
    if (obj.userData.cargoId === excludeCargoId) return;

    box3.setFromObject(obj);
    result.push(
      makeAabb(
        box3.min.x,
        box3.min.y,
        box3.min.z,
        box3.max.x - box3.min.x,
        box3.max.y - box3.min.y,
        box3.max.z - box3.min.z,
      ),
    );
  });

  return result;
}

/** 递归设置货物 Mesh 的 emissive 颜色 */
function applyEmissiveColor(mesh: THREE.Mesh, color: THREE.Color): void {
  // 设置自身（cargo mesh 是 MeshStandardMaterial）
  const mat = mesh.material as THREE.MeshStandardMaterial;
  if (mat?.emissive) {
    mat.emissive.copy(color);
    mat.needsUpdate = true;
  }
  // 跳过子节点（子节点是 LineSegments/边线，无 emissive）
}

// ─────────────────────────────────────────────────────────────
// Hook 公开接口
// ─────────────────────────────────────────────────────────────

export interface UseDragInteractionReturn {
  /**
   * 在 pointerdown 时调用。
   * 若击中货物则开始拖拽会话，返回 true；否则返回 false。
   * 调用方可根据返回值决定是否执行选中逻辑。
   */
  onDragPointerDown: (event: PointerEvent) => boolean;
  onDragPointerMove: (event: PointerEvent) => void;
  onDragPointerUp: (event: PointerEvent) => void;
  /** 当前是否处于有效拖拽中（已超过阈值） */
  isActiveDragging: () => boolean;
}

/**
 * useDragInteraction — 将旧版 BoxStack inputSystem.js 的拖拽逻辑
 * 迁移到 React + imperative Three.js + Zustand 架构。
 *
 * @param cameraRef        - 主相机 ref
 * @param containerGroupRef - 包含所有集装箱的 Three.js Group ref
 * @param domElementRef    - renderer.domElement ref（用于坐标计算）
 * @param requestRender    - 按需渲染回调
 */
export function useDragInteraction(
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>,
  containerGroupRef: React.RefObject<THREE.Group | null>,
  domElementRef: React.RefObject<HTMLElement | null>,
  requestRender: () => void,
): UseDragInteractionReturn {
  const raycaster = useRef(new THREE.Raycaster());
  const planeHit = useRef(new THREE.Vector3());
  const session = useRef<DragSession | null>(null);

  const isActiveDragging = useCallback((): boolean => {
    return session.current?.hasExceededThreshold === true;
  }, []);

  const onDragPointerDown = useCallback(
    (event: PointerEvent): boolean => {
      if (event.button !== 0) return false;

      const camera = cameraRef.current;
      const group = containerGroupRef.current;
      const domElement = domElementRef.current;
      if (!camera || !group || !domElement) return false;

      const ndc = computeNDC(event, domElement);
      raycaster.current.setFromCamera(ndc, camera);

      // 从射线交叉点向上找到携带 isCargo 的 Mesh（placed，非 staging）
      let hitMesh: THREE.Mesh | null = null;
      for (const intersect of raycaster.current.intersectObjects(group.children, true)) {
        let obj: THREE.Object3D | null = intersect.object;
        while (obj && obj !== group) {
          if (
            obj instanceof THREE.Mesh &&
            obj.userData?.isCargo &&
            !obj.userData?.isStaging
          ) {
            hitMesh = obj;
            break;
          }
          obj = obj.parent;
        }
        if (hitMesh) break;
      }

      if (!hitMesh || !hitMesh.parent) return false;

      // 世界坐标 AABB 用于半尺寸 + 拖拽平面定位
      const box3 = new THREE.Box3().setFromObject(hitMesh);
      const worldCenter = new THREE.Vector3();
      box3.getCenter(worldCenter);
      const boxSize = new THREE.Vector3();
      box3.getSize(boxSize);
      const halfExtents = boxSize.multiplyScalar(0.5);

      // 水平拖拽平面：Y = 货物底面世界坐标
      const floorWorldY = box3.min.y;
      const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorWorldY);

      // 把鼠标击中点投影到拖拽平面，计算 XZ 偏移（避免抓取时货物跳位）
      raycaster.current.ray.intersectPlane(dragPlane, planeHit.current);
      const dragOffset = new THREE.Vector3(
        planeHit.current.x - worldCenter.x,
        0,
        planeHit.current.z - worldCenter.z,
      );

      session.current = {
        cargoMesh: hitMesh,
        cargoId: hitMesh.userData.cargoId as string,
        startLocalPosition: hitMesh.position.clone(),
        dragOffset,
        dragPlane,
        halfExtents,
        lastValidWorldPos: worldCenter.clone(),
        pointerStart: { x: event.clientX, y: event.clientY },
        hasExceededThreshold: false,
        isColliding: false,
        parent: hitMesh.parent,
      };

      // Pointer capture：确保即使鼠标移出 canvas 也能接收 pointermove / pointerup
      try {
        domElement.setPointerCapture(event.pointerId);
      } catch {
        // 部分场景下 setPointerCapture 可能失败，忽略即可
      }

      return true;
    },
    [cameraRef, containerGroupRef, domElementRef],
  );

  const onDragPointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = session.current;
      if (!drag) return;

      const camera = cameraRef.current;
      const group = containerGroupRef.current;
      const domElement = domElementRef.current;
      if (!camera || !group || !domElement) return;

      // 阈值判断：超过才算真正拖拽
      if (!drag.hasExceededThreshold) {
        const dx = event.clientX - drag.pointerStart.x;
        const dy = event.clientY - drag.pointerStart.y;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        drag.hasExceededThreshold = true;
        domElement.style.cursor = 'grabbing';
      }

      const ndc = computeNDC(event, domElement);
      raycaster.current.setFromCamera(ndc, camera);

      // 射线与拖拽平面求交
      if (!raycaster.current.ray.intersectPlane(drag.dragPlane, planeHit.current)) return;

      // 世界坐标目标位置（含网格吸附）
      const worldTargetX = snapToGrid(planeHit.current.x - drag.dragOffset.x);
      const worldTargetZ = snapToGrid(planeHit.current.z - drag.dragOffset.z);
      const worldTargetY = drag.dragPlane.constant * -1 + drag.halfExtents.y;

      // 构建候选 AABB（世界坐标系）
      const candidateAabb = makeAabb(
        worldTargetX - drag.halfExtents.x,
        worldTargetY - drag.halfExtents.y,
        worldTargetZ - drag.halfExtents.z,
        drag.halfExtents.x * 2,
        drag.halfExtents.y * 2,
        drag.halfExtents.z * 2,
      );

      const otherAabbs = gatherOtherCargoAabbs(group, drag.cargoId);
      const nowColliding = otherAabbs.some((aabb) => aabbIntersects(candidateAabb, aabb));

      if (!nowColliding) {
        // 将世界坐标转换为父节点本地坐标后设置 position
        const localTarget = new THREE.Vector3(worldTargetX, worldTargetY, worldTargetZ);
        drag.parent.worldToLocal(localTarget);
        drag.cargoMesh.position.copy(localTarget);
        drag.lastValidWorldPos.set(worldTargetX, worldTargetY, worldTargetZ);
      }

      // 仅在碰撞状态变化时更新 emissive（避免每帧 needsUpdate）
      if (nowColliding !== drag.isColliding) {
        drag.isColliding = nowColliding;
        applyEmissiveColor(drag.cargoMesh, nowColliding ? EMISSIVE_COLLIDE : EMISSIVE_VALID);
      }

      requestRender();
    },
    [cameraRef, containerGroupRef, domElementRef, requestRender],
  );

  const onDragPointerUp = useCallback(
    (event: PointerEvent) => {
      const drag = session.current;
      if (!drag) return;

      const domElement = domElementRef.current;
      if (domElement) {
        try {
          domElement.releasePointerCapture(event.pointerId);
        } catch {
          // 忽略
        }
        domElement.style.cursor = '';
      }

      if (drag.hasExceededThreshold) {
        // 探索性拖拽结束：归位到 solver 决定的原始位置
        drag.cargoMesh.position.copy(drag.startLocalPosition);
        applyEmissiveColor(drag.cargoMesh, EMISSIVE_RESET);
        requestRender();
      }

      session.current = null;
    },
    [domElementRef, requestRender],
  );

  return { onDragPointerDown, onDragPointerMove, onDragPointerUp, isActiveDragging };
}
