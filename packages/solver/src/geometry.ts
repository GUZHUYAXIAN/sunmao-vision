/**
 * geometry.ts — 纯数学几何工具函数
 *
 * 本模块只包含与坐标系、包围盒和碰撞检测相关的纯数学函数。
 * 无任何 UI / 物理引擎 / 渲染器依赖，所有函数均为无副作用纯函数。
 *
 * 坐标系约定（与 Three.js 一致，单位 mm）：
 *   X → 集装箱长度方向
 *   Y → 高度方向（竖直向上）
 *   Z → 集装箱宽度方向
 */

// ─────────────────────────────────────────────
// 基础类型
// ─────────────────────────────────────────────

/** 三维坐标/尺寸元组，单位 mm */
export type Vec3 = [number, number, number];

/**
 * 轴对齐包围盒（AABB），以最小角坐标 + 尺寸表示。
 * 物体在世界坐标中的占位区域，旋转后的版本由调用方提供。
 */
export type Aabb = {
  /** 包围盒在 X/Y/Z 方向的最小点（mm） */
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  /** 包围盒在 X/Y/Z 方向的最大点（mm） */
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
};

/**
 * 自由空间槽（Free Space Slot）——Guillotine 切割算法的核心数据结构。
 * 表示集装箱内尚未被占用的一块长方体区域。
 */
export type FreeSlot = {
  readonly x: number;  // 起始 X（mm）
  readonly y: number;  // 起始 Y（mm）
  readonly z: number;  // 起始 Z（mm）
  readonly length: number; // X 方向长度（mm）
  readonly height: number; // Y 方向高度（mm）
  readonly width: number;  // Z 方向宽度（mm）
};

/**
 * 货物在某一旋转变体下的有效尺寸。
 * 旋转仅允许绕 Y 轴 90° 翻转（长宽互换，高度不变）。
 */
export type RotationVariant = {
  /** 旋转角度，仅支持 0 或 90 度（绕 Y 轴） */
  readonly rotationY: 0 | 90;
  /** 旋转后占用的长度（X 方向，mm） */
  readonly length: number;
  /** 旋转后占用的高度（Y 方向，mm） */
  readonly height: number;
  /** 旋转后占用的宽度（Z 方向，mm） */
  readonly width: number;
};

/**
 * 几何比较时使用的绝对容差（mm）。
 *
 * 不能直接使用裸 `Number.EPSILON`：
 *   1. 业务坐标以 mm 为单位，量级通常远大于 1
 *   2. JS 浮点误差会在多次加减后累积到 `1e-13 ~ 1e-10`
 *
 * 这里采用“绝对下限 + 相对缩放”策略，既避免面贴面误判重叠，
 * 也避免把真实重叠吞掉。
 */
export const GEOMETRY_EPSILON_MM = 1e-6;

function computeGeometryTolerance(...values: number[]): number {
  const largestMagnitude = Math.max(1, ...values.map((value) => Math.abs(value)));
  return Math.max(GEOMETRY_EPSILON_MM, largestMagnitude * Number.EPSILON * 16);
}

function axisOverlaps(
  minA: number,
  maxA: number,
  minB: number,
  maxB: number,
): boolean {
  const tolerance = computeGeometryTolerance(minA, maxA, minB, maxB);
  return minA < maxB - tolerance && maxA > minB + tolerance;
}

// ─────────────────────────────────────────────
// AABB 工厂与基本操作
// ─────────────────────────────────────────────

/**
 * 从位置和尺寸构造 AABB。
 *
 * @param x - X 起始坐标（最小点，mm）
 * @param y - Y 起始坐标（mm）
 * @param z - Z 起始坐标（mm）
 * @param length - X 方向长度（mm）
 * @param height - Y 方向高度（mm）
 * @param width  - Z 方向宽度（mm）
 */
export function makeAabb(
  x: number,
  y: number,
  z: number,
  length: number,
  height: number,
  width: number,
): Aabb {
  return {
    minX: x,
    minY: y,
    minZ: z,
    maxX: x + length,
    maxY: y + height,
    maxZ: z + width,
  };
}

/** 从自由槽直接构造 AABB */
export function aabbFromSlot(slot: FreeSlot): Aabb {
  return makeAabb(slot.x, slot.y, slot.z, slot.length, slot.height, slot.width);
}

/** 计算 AABB 的体积（mm³） */
export function aabbVolume(aabb: Aabb): number {
  return (
    (aabb.maxX - aabb.minX) *
    (aabb.maxY - aabb.minY) *
    (aabb.maxZ - aabb.minZ)
  );
}

// ─────────────────────────────────────────────
// 碰撞检测（轴对齐，无旋转歧义）
// ─────────────────────────────────────────────

/**
 * 检测两个轴对齐包围盒是否相交（存在重叠体积）。
 *
 * 使用分离轴定理的退化形式（三轴均为世界轴）。
 * 仅在三个轴上均无分离间隙时判定为相交。
 * 各轴上的判断使用严格小于，使"刚好贴边"不算碰撞。
 */
export function aabbIntersects(boxA: Aabb, boxB: Aabb): boolean {
  return (
    axisOverlaps(boxA.minX, boxA.maxX, boxB.minX, boxB.maxX) &&
    axisOverlaps(boxA.minY, boxA.maxY, boxB.minY, boxB.maxY) &&
    axisOverlaps(boxA.minZ, boxA.maxZ, boxB.minZ, boxB.maxZ)
  );
}

/**
 * 检测 AABB 是否完全包含在集装箱边界内。
 *
 * @param box - 待检测的包围盒
 * @param containerLength - 集装箱内部长度 X（mm）
 * @param containerHeight - 集装箱内部高度 Y（mm）
 * @param containerWidth  - 集装箱内部宽度 Z（mm）
 */
export function isWithinContainer(
  box: Aabb,
  containerLength: number,
  containerHeight: number,
  containerWidth: number,
): boolean {
  const tolerance = computeGeometryTolerance(
    box.minX,
    box.minY,
    box.minZ,
    box.maxX,
    box.maxY,
    box.maxZ,
    containerLength,
    containerHeight,
    containerWidth,
  );

  return (
    box.minX >= -tolerance &&
    box.minY >= -tolerance &&
    box.minZ >= -tolerance &&
    box.maxX <= containerLength + tolerance &&
    box.maxY <= containerHeight + tolerance &&
    box.maxZ <= containerWidth + tolerance
  );
}

/**
 * 检测一个 AABB 是否与一组已占用 AABB 中的任意一个相交。
 *
 * @param candidate - 候选包围盒
 * @param occupied  - 已占用包围盒列表（不可变快照）
 */
export function hasAnyIntersection(candidate: Aabb, occupied: readonly Aabb[]): boolean {
  for (const occupiedBox of occupied) {
    if (aabbIntersects(candidate, occupiedBox)) {
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────
// 旋转变体生成
// ─────────────────────────────────────────────

/**
 * 为给定物体尺寸生成所有合法旋转变体。
 *
 * 当前版本只支持绕 Y 轴旋转 0° 和 90° 两种变体（长宽互换）。
 * 高度（Y 方向）在运输约束下通常不允许翻转。
 * 若长度等于宽度，则去重只返回一个变体，避免冗余计算。
 *
 * @param length - 原始长度（X 方向，mm）
 * @param height - 原始高度（Y 方向，mm）
 * @param width  - 原始宽度（Z 方向，mm）
 * @param allowRotation - 是否允许旋转，来自求解约束
 */
export function getRotationVariants(
  length: number,
  height: number,
  width: number,
  allowRotation: boolean,
): RotationVariant[] {
  const base: RotationVariant = { rotationY: 0, length, height, width };

  if (!allowRotation || length === width) {
    return [base];
  }

  const rotated: RotationVariant = {
    rotationY: 90,
    length: width,
    height,
    width: length,
  };

  return [base, rotated];
}

// ─────────────────────────────────────────────
// 自由空间槽工具
// ─────────────────────────────────────────────

/** 过滤掉尺寸过小（任意方向小于阈值）的无效槽，避免产生无意义候选 */
export function filterMinimalSlots(
  slots: FreeSlot[],
  minimumDimension: number,
): FreeSlot[] {
  return slots.filter(
    (slot) =>
      slot.length >= minimumDimension &&
      slot.height >= minimumDimension &&
      slot.width >= minimumDimension,
  );
}

/**
 * 去除被其他槽完全包含的冗余槽。
 * 算法复杂度 O(n²)，n 为槽数量。业务场景下 n 通常 < 200，可接受。
 */
export function deduplicateSlots(slots: FreeSlot[]): FreeSlot[] {
  return slots.filter((slot, selfIndex) => {
    return !slots.some((candidate, candidateIndex) => {
      if (candidateIndex === selfIndex) return false;

      if (slotsEqual(candidate, slot)) {
        return candidateIndex < selfIndex;
      }

      return slotContains(candidate, slot);
    });
  });
}

function slotsEqual(slotA: FreeSlot, slotB: FreeSlot): boolean {
  const tolerance = computeGeometryTolerance(
    slotA.x,
    slotA.y,
    slotA.z,
    slotA.length,
    slotA.height,
    slotA.width,
    slotB.x,
    slotB.y,
    slotB.z,
    slotB.length,
    slotB.height,
    slotB.width,
  );

  return (
    Math.abs(slotA.x - slotB.x) <= tolerance &&
    Math.abs(slotA.y - slotB.y) <= tolerance &&
    Math.abs(slotA.z - slotB.z) <= tolerance &&
    Math.abs(slotA.length - slotB.length) <= tolerance &&
    Math.abs(slotA.height - slotB.height) <= tolerance &&
    Math.abs(slotA.width - slotB.width) <= tolerance
  );
}

/** 判断 outer 槽是否完全包含 inner 槽 */
function slotContains(outer: FreeSlot, inner: FreeSlot): boolean {
  const tolerance = computeGeometryTolerance(
    outer.x,
    outer.y,
    outer.z,
    outer.length,
    outer.height,
    outer.width,
    inner.x,
    inner.y,
    inner.z,
    inner.length,
    inner.height,
    inner.width,
  );

  return (
    outer.x <= inner.x + tolerance &&
    outer.y <= inner.y + tolerance &&
    outer.z <= inner.z + tolerance &&
    outer.x + outer.length >= inner.x + inner.length - tolerance &&
    outer.y + outer.height >= inner.y + inner.height - tolerance &&
    outer.z + outer.width >= inner.z + inner.width - tolerance
  );
}

/**
 * 判断两个自由槽是否在三维空间中存在重叠。
 * 用于放置后切割更新自由空间列表。
 */
export function slotsIntersect(slotA: FreeSlot, slotB: FreeSlot): boolean {
  return aabbIntersects(aabbFromSlot(slotA), aabbFromSlot(slotB));
}
