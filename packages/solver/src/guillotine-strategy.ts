/**
 * guillotine-strategy.ts — 基于自由槽列表的 Guillotine 切割放置策略
 *
 * 将 placement-engine.ts 中经过实战验证的 Guillotine 算法封装为
 * PlacementStrategy 接口的默认实现。
 *
 * 算法核心思想（来自旧版 SmartContainer planner-core）：
 *   1. 维护一个自由槽列表（Free Slot List），初始化为整个集装箱内腔
 *   2. 对每件货物，在所有槽 × 旋转变体中按"底层优先"评分找最优落点
 *   3. 放置成功后，用 Guillotine 6 轴切割更新自由槽列表
 *
 * 评分策略（"Bottom-Left-Front First"）：
 *   score = y × 1_000_000 + z × 1_000 + x（越小越优先）
 */

import {
  type Aabb,
  type FreeSlot,
  type RotationVariant,
  GEOMETRY_EPSILON_MM,
  deduplicateSlots,
  filterMinimalSlots,
  getRotationVariants,
  hasAnyIntersection,
  isWithinContainer,
  makeAabb,
  slotsIntersect,
} from "./geometry";
import { hasSufficientBottomSupport } from "./weight-checker";
import type {
  ContainerDimensions,
  ItemDimensions,
  PlacementDecision,
  PlacementStrategy,
} from "./strategy";

// ─────────────────────────────────────────────
// 内部常量
// ─────────────────────────────────────────────

/**
 * Guillotine 切割后保留槽的最小有效尺寸（mm）。
 * 设为 1mm 使 filterMinimalSlots 仅过滤真正零尺寸槽，
 * 实际有效性判断依赖 findBestCandidate 的尺寸适配逻辑。
 */
const MINIMUM_SLOT_DIMENSION_MM = 1;

// ─────────────────────────────────────────────
// 内部类型
// ─────────────────────────────────────────────

/** 放置候选方案，用于内部评分比较 */
type PlacementCandidate = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly variant: RotationVariant;
  readonly score: number;
  readonly slotIndex: number;
};

// ─────────────────────────────────────────────
// 纯函数工具
// ─────────────────────────────────────────────

/**
 * 计算放置候选的优先级评分（越低越优先）。
 * 策略：底层（Y 小）> 靠前（Z 小）> 靠左（X 小）
 */
function computePlacementScore(x: number, y: number, z: number): number {
  return y * 1_000_000 + z * 1_000 + x;
}

/**
 * 在自由槽列表中寻找最优放置候选。
 * 对每个槽和每个旋转变体进行尺寸适配、边界检查和碰撞检查。
 */
function findBestCandidate(
  variants: RotationVariant[],
  freeSlots: readonly FreeSlot[],
  occupiedAabbs: readonly Aabb[],
  containerDimensions: ContainerDimensions,
): PlacementCandidate | null {
  let bestCandidate: PlacementCandidate | null = null;

  for (let slotIndex = 0; slotIndex < freeSlots.length; slotIndex++) {
    const slot = freeSlots[slotIndex]!;

    for (const variant of variants) {
      if (
        variant.length > slot.length + GEOMETRY_EPSILON_MM ||
        variant.height > slot.height + GEOMETRY_EPSILON_MM ||
        variant.width > slot.width + GEOMETRY_EPSILON_MM
      ) {
        continue;
      }

      const x = slot.x;
      const y = slot.y;
      const z = slot.z;

      const candidateAabb = makeAabb(x, y, z, variant.length, variant.height, variant.width);

      if (
        !isWithinContainer(
          candidateAabb,
          containerDimensions.length,
          containerDimensions.height,
          containerDimensions.width,
        )
      ) {
        continue;
      }

      if (hasAnyIntersection(candidateAabb, occupiedAabbs)) {
        continue;
      }

      if (!hasSufficientBottomSupport(candidateAabb, occupiedAabbs)) {
        continue;
      }

      const score = computePlacementScore(x, y, z);
      if (bestCandidate === null || score < bestCandidate.score) {
        bestCandidate = { x, y, z, variant, score, slotIndex };
      }
    }
  }

  return bestCandidate;
}

/**
 * 将自由槽的坐标和尺寸严格 clamp 到集装箱物理边界内。
 * 防御性操作：消除 Guillotine 切割后因浮点累积产生的微小越界。
 */
function clampSlotToContainer(
  slot: FreeSlot,
  containerLength: number,
  containerHeight: number,
  containerWidth: number,
): FreeSlot | null {
  const clampedX = Math.max(0, slot.x);
  const clampedY = Math.max(0, slot.y);
  const clampedZ = Math.max(0, slot.z);

  const clampedEndX = Math.min(slot.x + slot.length, containerLength);
  const clampedEndY = Math.min(slot.y + slot.height, containerHeight);
  const clampedEndZ = Math.min(slot.z + slot.width, containerWidth);

  const clampedLength = clampedEndX - clampedX;
  const clampedHeight = clampedEndY - clampedY;
  const clampedWidth = clampedEndZ - clampedZ;

  if (clampedLength <= 0 || clampedHeight <= 0 || clampedWidth <= 0) {
    return null;
  }

  return {
    x: clampedX,
    y: clampedY,
    z: clampedZ,
    length: clampedLength,
    height: clampedHeight,
    width: clampedWidth,
  };
}

/**
 * 放置一个货物后，用 Guillotine 6 轴切割更新自由槽列表。
 *
 * 对每个与占用区相交的槽，从 6 个方向切割出残余子槽：
 *   X 轴：左侧 + 右侧
 *   Y 轴：下方 + 上方（均需生成，防止穿模 Bug）
 *   Z 轴：前侧 + 后侧
 *
 * 切割后每个子槽经过容器边界 clamp，过滤太小的槽并去重。
 */
function guillotineCut(
  currentSlots: FreeSlot[],
  occupied: FreeSlot,
  minimumSlotSize: number,
  containerLength: number,
  containerHeight: number,
  containerWidth: number,
): FreeSlot[] {
  const rawCuts: FreeSlot[] = [];

  for (const slot of currentSlots) {
    if (!slotsIntersect(slot, occupied)) {
      rawCuts.push(slot);
      continue;
    }

    // ── X 轴左侧残余槽 ────────────────────────────────────────────
    if (occupied.x > slot.x + GEOMETRY_EPSILON_MM) {
      rawCuts.push({ ...slot, length: occupied.x - slot.x });
    }

    // ── X 轴右侧残余槽 ────────────────────────────────────────────
    const occupiedRight = occupied.x + occupied.length;
    const slotRight = slot.x + slot.length;
    if (occupiedRight < slotRight - GEOMETRY_EPSILON_MM) {
      rawCuts.push({
        ...slot,
        x: occupiedRight,
        length: slotRight - occupiedRight,
      });
    }

    // ── Y 轴下方残余槽 ────────────────────────────────────────────
    // 当被占用区域底面高于自由槽底面时，下方仍有合法空间（slot.y ~ occupied.y）。
    // 不生成此子槽会导致下方空间被错误吞掉，后续货物产生 Y 轴方向穿模。
    if (occupied.y > slot.y + GEOMETRY_EPSILON_MM) {
      rawCuts.push({ ...slot, height: occupied.y - slot.y });
    }

    // ── Y 轴上方残余槽 ────────────────────────────────────────────
    const occupiedTop = occupied.y + occupied.height;
    const slotTop = slot.y + slot.height;
    if (occupiedTop < slotTop - GEOMETRY_EPSILON_MM) {
      rawCuts.push({
        ...slot,
        y: occupiedTop,
        height: slotTop - occupiedTop,
      });
    }

    // ── Z 轴前侧残余槽 ────────────────────────────────────────────
    if (occupied.z > slot.z + GEOMETRY_EPSILON_MM) {
      rawCuts.push({ ...slot, width: occupied.z - slot.z });
    }

    // ── Z 轴后侧残余槽 ────────────────────────────────────────────
    const occupiedBack = occupied.z + occupied.width;
    const slotBack = slot.z + slot.width;
    if (occupiedBack < slotBack - GEOMETRY_EPSILON_MM) {
      rawCuts.push({
        ...slot,
        z: occupiedBack,
        width: slotBack - occupiedBack,
      });
    }
  }

  // clamp 每个子槽到容器边界，过滤零尺寸槽，去重
  const clampedSlots: FreeSlot[] = [];
  for (const slot of rawCuts) {
    const clamped = clampSlotToContainer(slot, containerLength, containerHeight, containerWidth);
    if (clamped !== null) {
      clampedSlots.push(clamped);
    }
  }

  return deduplicateSlots(filterMinimalSlots(clampedSlots, minimumSlotSize));
}

// ─────────────────────────────────────────────
// 策略实现
// ─────────────────────────────────────────────

/**
 * Guillotine 切割放置策略（默认策略）。
 *
 * 基于自由槽列表（Free Slot List）的 Guillotine 算法，
 * 优先填充底层（Y 最小），再填靠前（Z 最小），最后靠左（X 最小）。
 *
 * 来源：旧版 SmartContainer planner-core 的提炼与重构，
 * 增加了 Y 轴下方子槽切割、底面支撑率校验和浮点容差机制。
 */
export class GuillotinePlacementStrategy implements PlacementStrategy {
  readonly name = "guillotine";

  findBestPlacement(
    item: ItemDimensions,
    freeSlots: FreeSlot[],
    containerDimensions: ContainerDimensions,
    existingPlacements: Aabb[],
    allowRotation: boolean,
  ): PlacementDecision | null {
    const variants = getRotationVariants(
      item.length,
      item.height,
      item.width,
      allowRotation,
    );

    const candidate = findBestCandidate(variants, freeSlots, existingPlacements, containerDimensions);

    if (candidate === null) {
      return null;
    }

    return {
      position: [candidate.x, candidate.y, candidate.z],
      rotation: [0, candidate.variant.rotationY, 0],
      slotIndex: candidate.slotIndex,
    };
  }

  afterPlacement(
    occupied: FreeSlot,
    currentSlots: FreeSlot[],
    containerDimensions: ContainerDimensions,
  ): FreeSlot[] {
    return guillotineCut(
      currentSlots,
      occupied,
      MINIMUM_SLOT_DIMENSION_MM,
      containerDimensions.length,
      containerDimensions.height,
      containerDimensions.width,
    );
  }
}
