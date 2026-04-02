/**
 * voxel-collision.ts — 体素化碰撞精炼模块（P1 预研）
 *
 * 基于旧版 BoxStack/voxelBody.js §5 中体素化贪心合并算法的提炼。
 *
 * 适用场景：
 *   当标准 AABB 包络体精度不足时（如 L 型、U 型、T 型异形货物），
 *   用体素网格代替 AABB 进行更精确的碰撞检测。
 *
 * 核心算法（来自 voxelBody.js 贪心合并）：
 *   1. 将几何体离散化为体素网格（Set of voxel keys）
 *   2. 贪心合并：沿 X → Y → Z 依次扩展，将连续填充的体素合并为更大的 Box
 *   3. 相交检测：两个体素体互查每个 Sub-box 是否 AABB 相交
 *
 * 本模块无任何 Three.js / Cannon.js / DOM 依赖，可直接在 Node.js 环境运行。
 *
 * @module voxel-collision
 */

import { type Aabb, GEOMETRY_EPSILON_MM, aabbIntersects, makeAabb } from "./geometry";

// ─────────────────────────────────────────────
// 基础数据结构
// ─────────────────────────────────────────────

/** 体素体：由若干 Aabb（Sub-box）的并集构成，可表示 L/U/T 型等异形货物 */
export type VoxelBody = {
  /** 构成体素体的子长方体列表（每个子 box 均在货物局部坐标系下） */
  readonly subBoxes: ReadonlyArray<Aabb>;
  /** 体素尺寸（mm），用于诊断和调试 */
  readonly voxelSizeMm: number;
};

/** 体素网格坐标（整数三元组） */
type VoxelCoord = [number, number, number];

/** 体素网格 Key（用于 Set 存储） */
type VoxelKey = `${number},${number},${number}`;

// ─────────────────────────────────────────────
// 体素化工具函数
// ─────────────────────────────────────────────

/** 将三维格点坐标编码为 Set 中使用的字符串 Key */
function encodeVoxelKey(gx: number, gy: number, gz: number): VoxelKey {
  return `${gx},${gy},${gz}`;
}

/** 将字符串 Key 解码回整数格点坐标 */
function decodeVoxelKey(key: VoxelKey): VoxelCoord {
  const parts = key.split(",").map(Number);
  return [parts[0]!, parts[1]!, parts[2]!];
}

/**
 * 将占用点列表离散化为体素格点 Set。
 *
 * @param occupiedPoints - 物体实际占据的三维点位（每个点是货物体积内的一个采样点）
 * @param voxelSizeMm    - 体素边长（mm）
 * @param originX        - 体素网格原点 X（通常为物体 AABB 最小 X）
 * @param originY        - 体素网格原点 Y
 * @param originZ        - 体素网格原点 Z
 * @returns 占据的体素格点 Set
 */
function pointsToVoxelGrid(
  occupiedPoints: ReadonlyArray<[number, number, number]>,
  voxelSizeMm: number,
  originX: number,
  originY: number,
  originZ: number,
): Set<VoxelKey> {
  const gridSet = new Set<VoxelKey>();
  for (const [px, py, pz] of occupiedPoints) {
    const gx = Math.floor((px - originX) / voxelSizeMm);
    const gy = Math.floor((py - originY) / voxelSizeMm);
    const gz = Math.floor((pz - originZ) / voxelSizeMm);
    gridSet.add(encodeVoxelKey(gx, gy, gz));
  }
  return gridSet;
}

/**
 * 贪心合并体素格点为尽可能大的 Aabb Sub-box 列表。
 *
 * 合并策略（来自 voxelBody.js L49-L98）：
 *   1. 对每个未访问格点，沿 X 轴尽量向右扩展
 *   2. 再沿 Y 轴向上扩展（确保整行 X 都可扩展）
 *   3. 最后沿 Z 轴向后扩展（确保整面 X×Y 都可扩展）
 *   4. 将扩展结果加入结果集，所有已覆盖格点标记为已访问
 *
 * 贪心合并可以大幅减少 Sub-box 数量，提升相交检测性能。
 *
 * @param gridSet     - 填充体素的格点 Set
 * @param voxelSizeMm - 体素边长（mm）
 * @param originX     - 网格原点 X（mm）
 * @param originY     - 网格原点 Y（mm）
 * @param originZ     - 网格原点 Z（mm）
 * @returns 合并后的 Aabb 列表（在世界坐标系下）
 */
function greedyMergeVoxels(
  gridSet: Set<VoxelKey>,
  voxelSizeMm: number,
  originX: number,
  originY: number,
  originZ: number,
): Aabb[] {
  const visited = new Set<VoxelKey>();
  const subBoxes: Aabb[] = [];

  for (const startKey of gridSet) {
    if (visited.has(startKey)) continue;

    const [startGx, startGy, startGz] = decodeVoxelKey(startKey);

    // 沿 X 扩展
    let endGx = startGx;
    while (gridSet.has(encodeVoxelKey(endGx + 1, startGy, startGz))) {
      endGx++;
    }

    // 沿 Y 扩展（整行 X 都必须填充）
    let endGy = startGy;
    yExpand: while (true) {
      for (let gx = startGx; gx <= endGx; gx++) {
        if (!gridSet.has(encodeVoxelKey(gx, endGy + 1, startGz))) {
          break yExpand;
        }
      }
      endGy++;
    }

    // 沿 Z 扩展（整面 X×Y 都必须填充）
    let endGz = startGz;
    zExpand: while (true) {
      for (let gx = startGx; gx <= endGx; gx++) {
        for (let gy = startGy; gy <= endGy; gy++) {
          if (!gridSet.has(encodeVoxelKey(gx, gy, endGz + 1))) {
            break zExpand;
          }
        }
      }
      endGz++;
    }

    // 标记所有已覆盖格点为已访问
    for (let gx = startGx; gx <= endGx; gx++) {
      for (let gy = startGy; gy <= endGy; gy++) {
        for (let gz = startGz; gz <= endGz; gz++) {
          visited.add(encodeVoxelKey(gx, gy, gz));
        }
      }
    }

    // 生成此 Sub-box 的 Aabb
    const minX = originX + startGx * voxelSizeMm;
    const minY = originY + startGy * voxelSizeMm;
    const minZ = originZ + startGz * voxelSizeMm;
    const boxLength = (endGx - startGx + 1) * voxelSizeMm;
    const boxHeight = (endGy - startGy + 1) * voxelSizeMm;
    const boxWidth = (endGz - startGz + 1) * voxelSizeMm;

    subBoxes.push(makeAabb(minX, minY, minZ, boxLength, boxHeight, boxWidth));
  }

  return subBoxes;
}

// ─────────────────────────────────────────────
// 公开 API
// ─────────────────────────────────────────────

/**
 * 将采样点列表体素化为 VoxelBody（Sub-box 合集）。
 *
 * 用法：
 *   当货物形状不规则时（如 L 型、U 型），通过几何采样得到货物内的点位，
 *   再调用此函数生成精确碰撞体。
 *
 * @param occupiedPoints - 货物实际填充区域的三维采样点（局部坐标系，origin = AABB 最小角）
 * @param voxelSizeMm    - 体素大小（mm）。值越小精度越高但性能越低。
 * @param originX        - 采样点坐标系原点 X（mm）
 * @param originY        - 采样点坐标系原点 Y（mm）
 * @param originZ        - 采样点坐标系原点 Z（mm）
 * @returns 体素体（由合并后的 Sub-box 列表构成）
 */
export function buildVoxelBody(
  occupiedPoints: ReadonlyArray<[number, number, number]>,
  voxelSizeMm: number,
  originX = 0,
  originY = 0,
  originZ = 0,
): VoxelBody {
  if (voxelSizeMm <= 0) {
    throw new RangeError(`voxelSizeMm must be > 0, got ${voxelSizeMm}`);
  }
  if (occupiedPoints.length === 0) {
    return { subBoxes: [], voxelSizeMm };
  }

  const gridSet = pointsToVoxelGrid(occupiedPoints, voxelSizeMm, originX, originY, originZ);
  const subBoxes = greedyMergeVoxels(gridSet, voxelSizeMm, originX, originY, originZ);

  return { subBoxes, voxelSizeMm };
}

/**
 * 从长方体尺寸直接构造 VoxelBody（退化为单个 Sub-box 的 AABB 情形）。
 * 用于将普通 AABB 货物纳入体素碰撞体系，保持接口统一。
 *
 * @param minX   - AABB 最小 X（mm）
 * @param minY   - AABB 最小 Y（mm）
 * @param minZ   - AABB 最小 Z（mm）
 * @param length - X 方向长度（mm）
 * @param height - Y 方向高度（mm）
 * @param width  - Z 方向宽度（mm）
 */
export function buildBoxVoxelBody(
  minX: number,
  minY: number,
  minZ: number,
  length: number,
  height: number,
  width: number,
): VoxelBody {
  return {
    subBoxes: [makeAabb(minX, minY, minZ, length, height, width)],
    voxelSizeMm: Math.min(length, height, width),
  };
}

/**
 * 构造一个 L 型货物的体素体（预设几何）。
 *
 * L 型货物由两段长方体组成（底座 + 直立段）：
 *   - 水平段：从 (0, 0, 0) 延伸 (baseLenX × baseHeight × fullWidth)
 *   - 直立段：从 (0, 0, 0) 延伸 (stemLenX × stemHeight × fullWidth)
 *     堆叠在水平段顶部
 *
 * @param baseLenX    - 底座水平长度（mm）
 * @param baseHeight  - 底座高度（mm）
 * @param stemLenX    - 直立段长度（mm，≤ baseLenX）
 * @param stemHeight  - 直立段额外高度（mm）
 * @param fullWidth   - Z 方向总宽度（mm）
 * @param originX     - 全局偏移 X（mm）
 * @param originY     - 全局偏移 Y（mm）
 * @param originZ     - 全局偏移 Z（mm）
 */
export function buildLShapeVoxelBody(
  baseLenX: number,
  baseHeight: number,
  stemLenX: number,
  stemHeight: number,
  fullWidth: number,
  originX = 0,
  originY = 0,
  originZ = 0,
): VoxelBody {
  return {
    subBoxes: [
      // 底座水平段
      makeAabb(originX, originY, originZ, baseLenX, baseHeight, fullWidth),
      // 直立段（叠在底座左侧顶部）
      makeAabb(originX, originY + baseHeight, originZ, stemLenX, stemHeight, fullWidth),
    ],
    voxelSizeMm: Math.min(baseLenX, baseHeight, fullWidth),
  };
}

/**
 * 构造一个 U 型货物的体素体（预设几何）。
 *
 * U 型由三段组成：左侧直立段 + 底座 + 右侧直立段。
 *
 * @param totalLenX   - 总长度（mm）
 * @param wallWidth   - 两侧壁厚（mm）
 * @param wallHeight  - 直立段高度（mm）
 * @param baseHeight  - 底座高度（mm）
 * @param fullWidth   - Z 方向总宽度（mm）
 * @param originX     - 全局偏移 X（mm）
 * @param originY     - 全局偏移 Y（mm）
 * @param originZ     - 全局偏移 Z（mm）
 */
export function buildUShapeVoxelBody(
  totalLenX: number,
  wallWidth: number,
  wallHeight: number,
  baseHeight: number,
  fullWidth: number,
  originX = 0,
  originY = 0,
  originZ = 0,
): VoxelBody {
  return {
    subBoxes: [
      // 底座
      makeAabb(originX, originY, originZ, totalLenX, baseHeight, fullWidth),
      // 左侧直立段
      makeAabb(originX, originY + baseHeight, originZ, wallWidth, wallHeight, fullWidth),
      // 右侧直立段
      makeAabb(
        originX + totalLenX - wallWidth,
        originY + baseHeight,
        originZ,
        wallWidth,
        wallHeight,
        fullWidth,
      ),
    ],
    voxelSizeMm: Math.min(wallWidth, baseHeight, fullWidth),
  };
}

/**
 * 检测两个体素体是否相交。
 *
 * 算法：逐对检查两个体素体的所有 Sub-box 组合。
 * 对于贪心合并后的体素体，Sub-box 数量通常很小（< 10），
 * 所以 O(m×n) 的逐对检测在实践中效率可接受。
 *
 * @param voxelA - 第一个体素体（世界坐标系）
 * @param voxelB - 第二个体素体（世界坐标系）
 * @returns true 若两个体素体有任意 Sub-box 对相交
 */
export function voxelIntersects(voxelA: VoxelBody, voxelB: VoxelBody): boolean {
  for (const boxA of voxelA.subBoxes) {
    for (const boxB of voxelB.subBoxes) {
      if (aabbIntersects(boxA, boxB)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 计算体素体的近似包络 AABB（用于快速粗筛）。
 *
 * @param voxelBody - 输入体素体
 * @returns 包含所有 Sub-box 的最大外包 AABB，若体素体为空则返回 null
 */
export function computeVoxelBodBoundingAabb(voxelBody: VoxelBody): Aabb | null {
  if (voxelBody.subBoxes.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const box of voxelBody.subBoxes) {
    minX = Math.min(minX, box.minX);
    minY = Math.min(minY, box.minY);
    minZ = Math.min(minZ, box.minZ);
    maxX = Math.max(maxX, box.maxX);
    maxY = Math.max(maxY, box.maxY);
    maxZ = Math.max(maxZ, box.maxZ);
  }

  return { minX, minY, minZ, maxX, maxY, maxZ };
}

/**
 * 计算体素体的总体积（所有 Sub-box 体积之和）。
 * 若体素体为凸形（Sub-box 不重叠），此值等于实际体积。
 *
 * @param voxelBody - 输入体素体
 * @returns 体积（mm³）
 */
export function computeVoxelBodyVolume(voxelBody: VoxelBody): number {
  let totalVolume = 0;
  for (const box of voxelBody.subBoxes) {
    const length = box.maxX - box.minX;
    const height = box.maxY - box.minY;
    const width = box.maxZ - box.minZ;
    totalVolume += length * height * width;
  }
  return totalVolume;
}

/**
 * 将体素体按世界坐标偏移量平移，返回新体素体（不修改原对象）。
 *
 * @param voxelBody - 原始体素体
 * @param dx        - X 方向偏移（mm）
 * @param dy        - Y 方向偏移（mm）
 * @param dz        - Z 方向偏移（mm）
 * @returns 平移后的新体素体
 */
export function translateVoxelBody(voxelBody: VoxelBody, dx: number, dy: number, dz: number): VoxelBody {
  return {
    subBoxes: voxelBody.subBoxes.map((box) => ({
      minX: box.minX + dx,
      minY: box.minY + dy,
      minZ: box.minZ + dz,
      maxX: box.maxX + dx,
      maxY: box.maxY + dy,
      maxZ: box.maxZ + dz,
    })),
    voxelSizeMm: voxelBody.voxelSizeMm,
  };
}

/**
 * 两阶段相交检测（带 AABB 快速粗筛）。
 *
 * 先用外包 AABB 做粗筛（O(1)），只有粗筛通过才做精确体素相交检测。
 * 当体素体包含大量 Sub-box 时，此优化可显著减少计算量。
 *
 * @param voxelA - 第一个体素体
 * @param voxelB - 第二个体素体
 * @returns true 若两个体素体有任意 Sub-box 对相交
 */
export function voxelIntersectsFast(voxelA: VoxelBody, voxelB: VoxelBody): boolean {
  // 粗筛：外包 AABB 不碰则直接返回 false
  const boundA = computeVoxelBodBoundingAabb(voxelA);
  const boundB = computeVoxelBodBoundingAabb(voxelB);

  if (boundA === null || boundB === null) {
    return false;
  }

  // 使用 GEOMETRY_EPSILON_MM 容差进行粗筛（与 aabbIntersects 一致）
  if (
    boundA.maxX <= boundB.minX + GEOMETRY_EPSILON_MM ||
    boundB.maxX <= boundA.minX + GEOMETRY_EPSILON_MM ||
    boundA.maxY <= boundB.minY + GEOMETRY_EPSILON_MM ||
    boundB.maxY <= boundA.minY + GEOMETRY_EPSILON_MM ||
    boundA.maxZ <= boundB.minZ + GEOMETRY_EPSILON_MM ||
    boundB.maxZ <= boundA.minZ + GEOMETRY_EPSILON_MM
  ) {
    return false;
  }

  // 精确逐对检测
  return voxelIntersects(voxelA, voxelB);
}
