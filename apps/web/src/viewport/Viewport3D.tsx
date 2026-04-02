import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CameraControls } from './CameraControls';
import { useDragInteraction } from './useDragInteraction';
import { useProjectStore } from '../stores/useProjectStore';

type MaterialWithUniforms = THREE.Material & {
  [key: string]: unknown;
  uniforms?: Record<string, { value?: unknown }>;
};

const disposeTextureValue = (value: unknown, disposedTextures: Set<THREE.Texture>) => {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => disposeTextureValue(entry, disposedTextures));
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  const textureCandidate = value as THREE.Texture;
  if (!textureCandidate.isTexture || disposedTextures.has(textureCandidate)) {
    return;
  }

  disposedTextures.add(textureCandidate);
  textureCandidate.dispose();
};

const disposeMaterial = (
  material: THREE.Material,
  disposedMaterials: Set<THREE.Material>,
  disposedTextures: Set<THREE.Texture>
) => {
  if (disposedMaterials.has(material)) {
    return;
  }

  const materialWithUniforms = material as MaterialWithUniforms;

  Object.values(materialWithUniforms).forEach((propertyValue) => {
    disposeTextureValue(propertyValue, disposedTextures);
  });

  if (materialWithUniforms.uniforms) {
    Object.values(materialWithUniforms.uniforms).forEach((uniform: any) => {
      disposeTextureValue(uniform?.value, disposedTextures);
    });
  }

  disposedMaterials.add(material);
  material.dispose();
};

const disposeSceneGraph = (scene: THREE.Scene) => {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  disposeTextureValue(scene.background, disposedTextures);
  disposeTextureValue(scene.environment, disposedTextures);

  scene.traverse((object3D: any) => {
    const renderableObject = object3D as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };

    if (renderableObject.geometry && !disposedGeometries.has(renderableObject.geometry)) {
      disposedGeometries.add(renderableObject.geometry);
      renderableObject.geometry.dispose();
    }

    if (!renderableObject.material) {
      return;
    }

    const materials = Array.isArray(renderableObject.material)
      ? renderableObject.material
      : [renderableObject.material];

    materials.forEach((material: any) => disposeMaterial(material, disposedMaterials, disposedTextures));
  });

  scene.clear();
};


export const Viewport3D: React.FC = () => {
  const { project, solveResult, selectedIds } = useProjectStore();
  const containers = project?.containers || [];
  const cargoList = project?.cargoList || [];
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const requestRenderRef = useRef<() => void>(() => undefined);
  const containerGroupRef = useRef<THREE.Group | null>(null);
  const containerMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());

  // ── 拖拽交互所需的 Three.js 对象 refs（在 useEffect 内赋值）──
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererDomRef = useRef<HTMLElement | null>(null);

  const { onDragPointerDown, onDragPointerMove, onDragPointerUp, isActiveDragging } =
    useDragInteraction(
      cameraRef,
      containerGroupRef,
      rendererDomRef,
      () => requestRenderRef.current(),
    );

  // 使用 ref 包住拖拽回调，使下方 useEffect 可安全引用（避免依赖数组问题）
  const onDragPointerDownRef = useRef(onDragPointerDown);
  const onDragPointerMoveRef = useRef(onDragPointerMove);
  const onDragPointerUpRef = useRef(onDragPointerUp);
  const isActiveDraggingRef = useRef(isActiveDragging);
  useEffect(() => {
    onDragPointerDownRef.current = onDragPointerDown;
    onDragPointerMoveRef.current = onDragPointerMove;
    onDragPointerUpRef.current = onDragPointerUp;
    isActiveDraggingRef.current = isActiveDragging;
  });


  useEffect(() => {
    const hostElement = containerRef.current;
    if (!hostElement) return;

    // 1. 初始化场景
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#f7f2e8');

    // 2. 初始化相机 (这里以 mm 为物理单位，所以相机位置和视距放大约 1000 倍)
    const camera = new THREE.PerspectiveCamera(
      55,
      hostElement.clientWidth / hostElement.clientHeight,
      10,      // 近裁剪面
      100000    // 远裁剪面: 可视范围达到 100m
    );
    camera.position.set(8000, 5000, 10000);

    // 3. 初始化渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(hostElement.clientWidth, hostElement.clientHeight, false);
    // 确保 canvas 的 CSS 尺寸与容器完全一致，否则 getBoundingClientRect()
    // 返回的矩形将与渲染分辨率不匹配，导致射线拾取 NDC 坐标偏移
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    hostElement.appendChild(renderer.domElement);

    // 4. 初始化基础光影
    const ambientLight = new THREE.AmbientLight(0xf6f1e7, 1.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight('#fff7ef', 2.6);
    keyLight.position.set(4000, 6000, 8000);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#d5ecff', 1.1);
    rimLight.position.set(-5000, 3000, -4000);
    scene.add(rimLight);

    // 5. 初始化网格地板和坐标轴
    const grid = new THREE.GridHelper(10000, 100, '#cb8f33', '#d8c5ae');
    scene.add(grid);

    const axesHelper = new THREE.AxesHelper(5000);
    scene.add(axesHelper);

    const containerGroup = new THREE.Group();
    containerGroup.name = 'containers-group';
    scene.add(containerGroup);
    containerGroupRef.current = containerGroup;

    // 6. 初始化相机控制类 (包含各类交互操作)
    const controls = new CameraControls(camera, renderer.domElement, scene);

    // 暴露 camera / renderer.domElement 给拖拽 Hook
    cameraRef.current = camera;
    rendererDomRef.current = renderer.domElement;

    // 7. 按需渲染：只在交互、阻尼衰减或尺寸变化时申请一帧
    let animationFrameId: number | null = null;
    let isDisposed = false;

    const renderFrame = () => {
      animationFrameId = null;
      if (isDisposed) {
        return;
      }

      const stillChanging = controls.update();
      renderer.render(scene, camera);

      if (stillChanging) {
        requestRender();
      }
    };

    const requestRender = () => {
      if (isDisposed || animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    requestRenderRef.current = requestRender;
    controls.orbControls.addEventListener('change', requestRender);
    requestRender();

    // 8. 处理窗口 Resize
    const handleResize = () => {
      if (isDisposed || !containerRef.current) return;

      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight, false);
      requestRender();
    };
    window.addEventListener('resize', handleResize);

    const selectionRaycaster = new THREE.Raycaster();
    const selectionMouse = new THREE.Vector2();

    /**
     * 统一 pointerdown 处理器：
     *   1. 先交给拖拽 Hook 尝试命中货物（若命中则开始拖拽会话）
     *   2. 无论是否拖拽，同步执行选中逻辑（点击即选中）
     *   3. 拖拽松手后 Hook 负责归位，选中状态在这里已完成，无需重复处理
     */
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !containerGroupRef.current || !containerRef.current) return;

      // 交给拖拽 Hook （若击中货物，Hook 内部会开始拖拽会话）
      const hitCargo = onDragPointerDownRef.current(event);

      // 执行选中逻辑
      const rect = containerRef.current.getBoundingClientRect();
      selectionMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      selectionMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      selectionRaycaster.setFromCamera(selectionMouse, camera);
      const intersects = selectionRaycaster.intersectObjects(
        containerGroupRef.current.children,
        true,
      );

      let clickedCargoId: string | null = null;
      let clickedContainerId: string | null = null;

      for (const intersect of intersects) {
        let obj: THREE.Object3D | null = intersect.object;
        while (obj) {
          if (obj.userData?.isCargo && !obj.userData?.isStaging) {
            clickedCargoId = obj.userData.cargoId as string;
            break;
          }
          if (obj.userData?.isContainer) {
            clickedContainerId = obj.userData.containerId as string;
            break;
          }
          obj = obj.parent;
        }
        if (clickedCargoId || clickedContainerId) break;
      }

      const { setSelection } = useProjectStore.getState();

      if (clickedCargoId) {
        setSelection(new Set([clickedCargoId]));
      } else if (clickedContainerId) {
        setSelection(new Set([`container_${clickedContainerId}`]));
      } else if (!hitCargo) {
        // 仅在未击中货物时清除选中，防止拖拽开始时误清空
        setSelection(new Set());
      }
    };

    // ── 拖拽交互事件代理（使用 ref 包的回调，避免闭包问题）──
    const handleDragMove = (event: PointerEvent) => onDragPointerMoveRef.current(event);
    const handleDragUp = (event: PointerEvent) => onDragPointerUpRef.current(event);

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', handleDragMove);
    // pointerup 注册在 window，确保鼠标移出 canvas 时也能收到松手事件
    window.addEventListener('pointerup', handleDragUp);

    // 组件卸载清理
    return () => {
      isDisposed = true;
      requestRenderRef.current = () => undefined;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerup', handleDragUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', handleDragMove);
      controls.orbControls.removeEventListener('change', requestRender);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      controls.dispose();
      disposeSceneGraph(scene);
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      sceneRef.current = null;
      containerGroupRef.current = null;
      containerMeshesRef.current.clear();
      cameraRef.current = null;
      rendererDomRef.current = null;
      if (hostElement.contains(renderer.domElement)) {
        hostElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 暴露对外的生命周期，用于挂载与解析传入的 Container 并在 Scene 中渲染
  useEffect(() => {
    if (!containerGroupRef.current || !containers) return;

    const group = containerGroupRef.current;
    const currentMap = containerMeshesRef.current as Map<string, THREE.Group | THREE.Mesh>;
    const nextIds = new Set(containers.map((c: any) => c.id));

    // 1. 找出需要卸载的旧节点
    const toRemove: THREE.Object3D[] = [];
    currentMap.forEach((obj, id) => {
      if (!nextIds.has(id)) {
        toRemove.push(obj);
        currentMap.delete(id);
      }
    });

    if (toRemove.length > 0) {
      const tempScene = new THREE.Scene();
      toRemove.forEach((obj) => {
        group.remove(obj);
        tempScene.add(obj);
      });
      disposeSceneGraph(tempScene);
    }

    // 追踪集装箱群组总 X 宽度（用于定位暂存区）
    let totalContainerGroupWidth = 0;
    let currentX = 0;

    // 2. 挂载或更新新节点
    let hasChanges = toRemove.length > 0;

    containers.forEach((c) => {
      let containerRoot = currentMap.get(c.id) as THREE.Group | undefined;

      // 每次重建，易于同步 solveResult 和选中状态
      if (containerRoot) {
        group.remove(containerRoot);
        const tempScene = new THREE.Scene();
        tempScene.add(containerRoot);
        disposeSceneGraph(tempScene);
      }

      containerRoot = new THREE.Group();

      // ── 集装箱外壳：透明正面用于视觉效果 ──
      const geometry = new THREE.BoxGeometry(c.length, c.height, c.width);
      const isContainerSelected = selectedIds.has(`container_${c.id}`);

      const containerVisMaterial = new THREE.MeshStandardMaterial({
        color: isContainerSelected ? 0x4488ff : 0x3399ff,
        transparent: true,
        opacity: isContainerSelected ? 0.25 : 0.12,
        side: THREE.FrontSide,
        depthWrite: false,
      });
      const containerVisMesh = new THREE.Mesh(geometry, containerVisMaterial);
      containerVisMesh.position.set(c.length / 2, c.height / 2, c.width / 2);

      // ── 缺陷 2 修复：集装箱背面拾取 Mesh ──
      // BackSide 面朝内，射线从外部击中时可以捕获，且几乎透明不影响视觉。
      // 标记 isContainer + containerId 供 raycaster 识别。
      const pickGeometry = new THREE.BoxGeometry(c.length, c.height, c.width);
      const pickMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.001, // 几乎完全透明，肉眼不可见
        side: THREE.BackSide,
        depthWrite: false,
      });
      const pickMesh = new THREE.Mesh(pickGeometry, pickMaterial);
      pickMesh.position.set(c.length / 2, c.height / 2, c.width / 2);
      pickMesh.userData = { isContainer: true, containerId: c.id };

      // 边线
      const edgesGeom = new THREE.EdgesGeometry(geometry);
      const lineMat = new THREE.LineBasicMaterial({
        color: isContainerSelected ? 0x66aaff : 0x2266cc,
        opacity: isContainerSelected ? 0.9 : 0.5,
        transparent: true,
      });
      const line = new THREE.LineSegments(edgesGeom, lineMat);
      line.position.set(c.length / 2, c.height / 2, c.width / 2);

      containerRoot.add(containerVisMesh);
      containerRoot.add(pickMesh);
      containerRoot.add(line);

      // 如果有求解结果，在此集装箱坐标系下摆放货物
      if (solveResult?.success) {
        solveResult.placements.forEach((placement) => {
          if (placement.containerId !== c.id) return;
          const cargo = cargoList[placement.cargoIndex];
          if (!cargo) return;

          // 原始模板尺寸（用于无旋转情况）
          const origLength = cargo.dimensions.length;
          const origWidth = cargo.dimensions.width;
          const origHeight = cargo.dimensions.height;

          // ── Solver 旋转约定：仅支持绕 Y 轴 0° 或 90°（见 geometry.ts getRotationVariants）─
          // 当 rotationY = 90 时，长宽已互换：
          //   AABB.x 方向占用 = 原始 width，AABB.z 方向占用 = 原始 length
          // 必须用旋转后的 AABB 尺寸来构建 BoxGeometry 和计算中心点偏移，
          // 否则中心点偏移错误，导致货物在视觉和物理上发生穿模。
          const [rx, ry, rz] = placement.rotation;
          const isRotated90 = Math.round(Math.abs(ry)) === 90;

          // 旋转后货物在三个轴方向的实际占用尺寸（与 Solver AABB 一致）
          const aabbLength = isRotated90 ? origWidth : origLength; // X 轴占用
          const aabbWidth  = isRotated90 ? origLength : origWidth; // Z 轴占用
          const aabbHeight = origHeight;                            // Y 轴占用（高度不变）

          // BoxGeometry 参数：(X 方向, Y 方向, Z 方向)
          // Three.js 中 BoxGeometry(width, height, depth) → X/Y/Z
          // 注意：BoxGeometry 内部不旋转，我们对 Mesh 整体旋转，所以几何体要配合旋转后的占用
          const cargoGeo = new THREE.BoxGeometry(aabbLength, aabbHeight, aabbWidth);

          const cargoMat = new THREE.MeshStandardMaterial({
            color: cargo.color,
            transparent: false,
            roughness: 0.6,
            metalness: 0.1,
          });

          const cargoId = `cargo_${placement.cargoIndex}_${placement.instanceIndex}`;
          const isSelected = selectedIds.has(cargoId);
          if (isSelected) {
            cargoMat.emissive.setHex(0x555555);
            cargoMat.opacity = 1.0;
            cargoMat.transparent = false;
          } else if (selectedIds.size > 0) {
            cargoMat.opacity = 0.4;
            cargoMat.transparent = true;
          }

          const cargoMesh = new THREE.Mesh(cargoGeo, cargoMat);
          cargoMesh.userData = { isCargo: true, cargoId };

          // 给货物加上黑色边线方便分辨
          const cargoEdges = new THREE.EdgesGeometry(cargoGeo);
          const cargoLine = new THREE.LineSegments(
            cargoEdges,
            new THREE.LineBasicMaterial({ color: isSelected ? 0xffffff : 0x000000 })
          );
          cargoMesh.add(cargoLine);

          // 姿态应用：先旋转，再确定位置
          // 注意：BoxGeometry 已经按旋转后尺寸构建，所以这里的 rotation 只影响纹理方向，
          // 不影响 AABB 空间占用——但保持旋转设置以便在有纹理时方向正确。
          cargoMesh.rotation.set(
            THREE.MathUtils.degToRad(rx),
            THREE.MathUtils.degToRad(ry),
            THREE.MathUtils.degToRad(rz)
          );

          // 位置偏移：Solver 输出的 position 是旋转后 AABB 的最小角坐标
          // Three.js Mesh 的 position 是几何体中心，所以加上旋转后各轴尺寸的一半
          const [px, py, pz] = placement.position;
          cargoMesh.position.set(
            px + aabbLength / 2,
            py + aabbHeight / 2,
            pz + aabbWidth / 2
          );

          containerRoot!.add(cargoMesh);
        });
      }

      group.add(containerRoot);
      currentMap.set(c.id, containerRoot as any);
      hasChanges = true;

      // 更新该集装箱根坐标位置，相邻排开，增加 1000mm 间距
      containerRoot.position.set(currentX, 0, 0);
      currentX += c.length + 1000;
    });

    // ── 缺陷 3 修复：渲染溢出货物暂存区 ──────────────────────────────────────
    //
    // 策略：先清理旧的暂存区节点，再从 unplacedItems 重建。
    // 暂存区起始 X = 所有集装箱群组的右边界 + 1000mm 间距。
    // 沿 Z 轴排列，每件货物以 AABB 落地放置（Y = height/2 使底面在 Y=0）。

    // 先清除旧暂存区
    const oldStagingGroup = group.getObjectByName('staging-group');
    if (oldStagingGroup) {
      const tempScene = new THREE.Scene();
      tempScene.add(oldStagingGroup);
      disposeSceneGraph(tempScene);
    }

    totalContainerGroupWidth = currentX;

    if (solveResult?.unplacedItems && solveResult.unplacedItems.length > 0) {
      const stagingGroup = new THREE.Group();
      stagingGroup.name = 'staging-group';

      // 修复要求 2：固定起始点为集装箱右侧外 startX = container.width + 1000
      // 我们用 totalContainerGroupWidth 作为参考，以确保超出当前集装箱的范围
      const containerWidth = containers[0]?.width || 2000;
      const startX = Math.max(totalContainerGroupWidth, containerWidth) + 1000;

      // 暂存区底板或者标牌(可以加个简单的平面提示)
      const floorGeo = new THREE.PlaneGeometry(2000, 20000);
      const floorMat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(startX, 1, 10000 - 1000);
      stagingGroup.add(floorMesh);

      // 为了选中逻辑的需要，维护每个货物模板被分配的 instanceIndex
      const instanceCountByCargoIndex = new Map<number, number>();

      solveResult.unplacedItems.forEach((item, index) => {
        // 修复要求 1：从 useProjectStore 的 cargoList(即templates) 提取出该货物真实的信息
        const cargo = cargoList[item.cargoIndex];
        if (!cargo) return;

        const allocatedInstance = instanceCountByCargoIndex.get(item.cargoIndex) ?? 0;
        instanceCountByCargoIndex.set(item.cargoIndex, allocatedInstance + 1);

        const { length, width, height } = cargo.dimensions;
        const color = cargo.color;

        // 真实尺寸 BoxGeometry
        const cargoGeo = new THREE.BoxGeometry(length, height, width);
        const cargoMat = new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: 0.75,
          roughness: 0.7,
          metalness: 0.05,
        });

        const cargoMesh = new THREE.Mesh(cargoGeo, cargoMat);
        
        // 修复要求 2：利用 index 分配错开的 Z 轴偏移量
        const offsetZ = index * 1000;

        // X = startX
        // Y = 真实高度 / 2 (地板二维平铺)
        // Z = offsetZ
        cargoMesh.position.set(startX, height / 2, offsetZ);

        cargoMesh.userData = {
          isCargo: true,
          cargoId: `staging_${item.cargoIndex}_${allocatedInstance}`,
          isStaging: true,
        };

        const edges = new THREE.EdgesGeometry(cargoGeo);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0xff3333 });
        const cargoLine = new THREE.LineSegments(edges, edgeMat);
        cargoMesh.add(cargoLine);

        // 如果被选中则给予高亮效果
        if (selectedIds.has(cargoMesh.userData.cargoId)) {
          cargoMat.emissive.setHex(0x555555);
          cargoMat.opacity = 1.0;
          cargoMat.transparent = false;
          edgeMat.color.setHex(0xffffff);
        }

        stagingGroup.add(cargoMesh);
      });

      group.add(stagingGroup);
      hasChanges = true;
    }

    if (hasChanges) {
      requestRenderRef.current();
    }
  }, [containers, cargoList, solveResult, selectedIds]);

  return (
    <div
      ref={containerRef}
      className="viewport-3d-container"
      style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
};
