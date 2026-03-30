/**
 * placement-engine.ts — 三维 Guillotine 空间切割放置引擎
 *
 * 实现基于自由空间列表（Free Space List）的 Guillotine 箱装算法。
 * 算法来源：对旧版 SmartContainer/planner-core 和 BoxStack/autoStack 的
 * 提炼与重构，剥离了全部 Three.js / cannon-es UI 耦合。
 *
 * 算法思想：
 *   1. 初始化一个等于集装箱内腔的自由槽
 *   2. 对每件货物，在所有自由槽 × 旋转变体 中寻找最优落点
 *      - 最优评分：优先填底层（Y 最小），其次填靠前（Z 最小），再次靠左（X 最小）
 *   3. 放置成功后，用 Guillotine 切割更新自由空间列表
 *   4. 无法放入的货物记录为 unplaced
 *
 * 所有函数均为无副作用纯函数，不修改任何输入参数。
 */

import type { CargoTemplate, Container, Placement } from "@sunmao/contracts";
import {
  type Aabb,
  type FreeSlot,
  GEOMETRY_EPSILON_MM,
  type RotationVariant,
  deduplicateSlots,
  filterMinimalSlots,
  getRotationVariants,
  hasAnyIntersection,
  isWithinContainer,
  makeAabb,
  slotsIntersect,
} from "./geometry";
import { hasSufficientBottomSupport } from "./weight-checker";

// ─────────────────────────────────────────────
// 内部类型
// ─────────────────────────────────────────────

/** 放置候选方案：一个货物实例放在某个自由槽的某种旋转下 */
type PlacementCandidate = {
  /** 落点 X 坐标（mm） */
  readonly x: number;
  /** 落点 Y 坐标（mm） */
  readonly y: number;
  /** 落点 Z 坐标（mm） */
  readonly z: number;
  readonly variant: RotationVariant;
  /** 评分越小越优先（填底优先） */
  readonly score: number;
};

/** 引擎配置：集装箱尺寸 + 求解约束（从外部传入，引擎本身无状态） */
export type EngineConfig = {
  readonly containerLength: number;
  readonly containerHeight: number;
  readonly containerWidth: number;
  /** 是否允许绕 Y 轴旋转货物 */
  readonly allowRotation: boolean;
  /** 最大堆叠层数（undefined = 不限制） */
  readonly maxStackLayers: number | undefined;
};

/** 单次货物放置的结果，供 solve.ts 聚合 */
export type ItemPlacementResult =
  | {
      readonly kind: "placed";
      readonly placement: Placement;
      readonly occupiedAabb: Aabb;
    }
  | {
      readonly kind: "unplaced";
      readonly reason: string;
    };

/** 整批货物在单个集装箱内的放置结果 */
export type ContainerPackResult = {
  readonly containerId: string;
  /** 成功放置的条目列表，顺序与输入 cargoList 对应 */
  readonly placed: Array<{
    readonly cargoIndex: number;
    readonly instanceIndex: number;
    readonly placement: Placement;
    readonly occupiedAabb: Aabb;
  }>;
  /** 未能放置的条目 */
  readonly unplaced: Array<{
    readonly cargoIndex: number;
    readonly instanceIndex: number;
    readonly reason: string;
  }>;
};

// ─────────────────────────────────────────────
// 评分函数
// ─────────────────────────────────────────────

/**
 * 计算放置候选的优先级评分（越低越优先）。
 *
 * 评分编码策略（借鉴自旧版 SmartContainer planner-core）：
 *   score = y × 1_000_000 + z × 1_000 + x
 *
 * 这保证了：
 *   - 底层（Y 小）优先：使重心更低，稳定性更好
 *   - 同层内靠前（Z 小）优先：从入口侧开始填
 *   - 同行内靠左（X 小）优先：紧凑排列
 */
function computePlacementScore(x: number, y: number, z: number): number {
  return y * 1_000_000 + z * 1_000 + x;
}

// ─────────────────────────────────────────────
// 候选搜索
// ─────────────────────────────────────────────

/**
 * 在自由槽列表中寻找最优放置候选。
 *
 * 对每个自由槽和每个旋转变体，检查货物是否能放入：
 *   1. 货物尺寸不超出槽的容量
 *   2. 放置后的 AABB 不超出集装箱边界（边界理论上由槽保证，但做防御性检查）
 *   3. 放置后与已占用 AABB 无交叉
 *
 * @param variants      - 该货物所有合法旋转变体
 * @param freeSlots     - 当前可用自由槽列表
 * @param occupiedAabbs - 已放置货物的 AABB 列表
 * @param config        - 引擎配置
 */
function findBestCandidate(
  variants: RotationVariant[],
  freeSlots: readonly FreeSlot[],
  occupiedAabbs: readonly Aabb[],
  config: EngineConfig,
): PlacementCandidate | null {
  let bestCandidate: PlacementCandidate | null = null;

  for (const slot of freeSlots) {
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

      if (!isWithinContainer(candidateAabb, config.containerLength, config.containerHeight, config.containerWidth)) {
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
        bestCandidate = { x, y, z, variant, score };
      }
    }
  }

  return bestCandidate;
}

// ─────────────────────────────────────────────
// Guillotine 空间切割
// ─────────────────────────────────────────────

/**
 * 放置一个货物后，用 Guillotine 水平切割更新自由空间列表。
 *
 * 对于每个与占用区域相交的槽，从 6 个方向（3轴 × 2方向）切割出
 * 剩余的自由子槽，然后过滤太小的槽并去重。
 *
 * 这是旧版 SmartContainer `buildLoadPlan` 中自由空间更新逻辑的
 * 纯函数化实现，增加了 Y 轴上方的切割（旧版遗漏）。
 *
 * @param currentSlots - 当前自由槽列表
 * @param occupied     - 刚刚被占用的空间区域（以 FreeSlot 形式表示）
 * @param minimumSlotSize - 有效槽的最小尺寸（mm），过小的槽直接丢弃
 */
function guillotineCut(
  currentSlots: FreeSlot[],
  occupied: FreeSlot,
  minimumSlotSize: number,
): FreeSlot[] {
  const nextSlots: FreeSlot[] = [];

  for (const slot of currentSlots) {
    if (!slotsIntersect(slot, occupied)) {
      nextSlots.push(slot);
      continue;
    }

    // X 轴左侧残余槽
    if (occupied.x > slot.x + GEOMETRY_EPSILON_MM) {
      nextSlots.push({ ...slot, length: occupied.x - slot.x });
    }

    // X 轴右侧残余槽
    const occupiedRight = occupied.x + occupied.length;
    const slotRight = slot.x + slot.length;
    if (occupiedRight < slotRight - GEOMETRY_EPSILON_MM) {
      nextSlots.push({
        ...slot,
        x: occupiedRight,
        length: slotRight - occupiedRight,
      });
    }

    // Y 轴上方残余槽（旧版 BoxStack 中存在，SmartContainer 中遗漏的方向）
    const occupiedTop = occupied.y + occupied.height;
    const slotTop = slot.y + slot.height;
    if (occupiedTop < slotTop - GEOMETRY_EPSILON_MM) {
      nextSlots.push({
        ...slot,
        y: occupiedTop,
        height: slotTop - occupiedTop,
      });
    }

    // Z 轴前侧残余槽
    if (occupied.z > slot.z + GEOMETRY_EPSILON_MM) {
      nextSlots.push({ ...slot, width: occupied.z - slot.z });
    }

    // Z 轴后侧残余槽
    const occupiedBack = occupied.z + occupied.width;
    const slotBack = slot.z + slot.width;
    if (occupiedBack < slotBack - GEOMETRY_EPSILON_MM) {
      nextSlots.push({
        ...slot,
        z: occupiedBack,
        width: slotBack - occupiedBack,
      });
    }
  }

  return deduplicateSlots(filterMinimalSlots(nextSlots, minimumSlotSize));
}

// ─────────────────────────────────────────────
// 公开入口
// ─────────────────────────────────────────────

/** Guillotine 槽清理时使用的最小有效尺寸阈值（mm） */
const MINIMUM_SLOT_DIMENSION_MM = 80;

/**
 * 在单个集装箱内执行多货物的三维放置排布。
 *
 * 本函数是求解引擎的核心计算单元，接收 Zod 验证后的契约数据，
 * 输出不含任何 UI 引用的纯 JSON 结果。
 *
 * @param cargoList  - 已按排序策略预处理过的货物列表，每项含 (template, quantity)
 * @param container  - 集装箱规格（来自 ContainerSchema）
 * @param config     - 引擎配置（约束条件）
 *
 * @returns ContainerPackResult — 成功/失败放置列表，供 solve.ts 聚合
 */
export function packIntoContainer(
  cargoList: ReadonlyArray<{ template: CargoTemplate; quantity: number; cargoIndex: number }>,
  container: Container,
  config: EngineConfig,
): ContainerPackResult {
  const { length: containerLength, height: containerHeight, width: containerWidth } = container;

  let freeSlots: FreeSlot[] = [
    {
      x: 0,
      y: 0,
      z: 0,
      length: containerLength,
      height: containerHeight,
      width: containerWidth,
    },
  ];

  const occupiedAabbs: Aabb[] = [];
  const placed: ContainerPackResult["placed"] = [];
  const unplaced: ContainerPackResult["unplaced"] = [];

  let currentTotalWeight = 0;

  for (const { template, quantity, cargoIndex } of cargoList) {
    for (let instanceIndex = 0; instanceIndex < quantity; instanceIndex++) {
      // 超重检测
      if (currentTotalWeight + template.weight > container.maxPayload) {
        unplaced.push({
          cargoIndex,
          instanceIndex,
          reason: `超出最大载重（当前 ${currentTotalWeight}kg，货物 ${template.weight}kg，上限 ${container.maxPayload}kg）`,
        });
        continue;
      }

      // 堆叠层数限制
      // 修复 Codex 发现的 P1 bug：
      //   旧实现 slot.y < layerHeight * maxStackLayers 等价于 slot.y < containerHeight，
      //   永远成立，从未真正拦截超限层。
      //
      // 正确语义：槽的底部 Y 坐标必须 < maxLayers 层的高度上限。
      //   即不允许在 y >= layerHeight * maxStackLayers 的槽上放置新货物。
      //   （每层高度 = 容器高度 / maxStackLayers，这是一种等高分层模型。）
      //   注意：货物本身的高度无法限制，这里只限制"起始放置高度"。
      const activeFreeSlots =
        config.maxStackLayers !== undefined
          ? (() => {
              const singleLayerHeight = containerHeight / config.maxStackLayers;
              const maxAllowedBottomY = singleLayerHeight * (config.maxStackLayers - 1);
              const filtered = freeSlots.filter(
                (slot) => slot.y <= maxAllowedBottomY + GEOMETRY_EPSILON_MM,
              );
              if (filtered.length === 0) {
                unplaced.push({
                  cargoIndex,
                  instanceIndex,
                  reason: `已达到最大堆叠层数限制（${config.maxStackLayers} 层），无可用层内起始槽`,
                });
                return null;
              }
              return filtered;
            })()
          : freeSlots;

      if (activeFreeSlots === null) continue;

      const variants = getRotationVariants(
        template.dimensions.length,
        template.dimensions.height,
        template.dimensions.width,
        config.allowRotation,
      );

      const candidate = findBestCandidate(variants, activeFreeSlots, occupiedAabbs, config);

      if (candidate === null) {
        unplaced.push({
          cargoIndex,
          instanceIndex,
          reason: "集装箱内无足够连续且受支撑的空间可放置本货物",
        });
        continue;
      }

      const occupiedAabb = makeAabb(
        candidate.x,
        candidate.y,
        candidate.z,
        candidate.variant.length,
        candidate.variant.height,
        candidate.variant.width,
      );

      occupiedAabbs.push(occupiedAabb);
      currentTotalWeight += template.weight;

      const occupiedSlot: FreeSlot = {
        x: candidate.x,
        y: candidate.y,
        z: candidate.z,
        length: candidate.variant.length,
        height: candidate.variant.height,
        width: candidate.variant.width,
      };

      freeSlots = guillotineCut(freeSlots, occupiedSlot, MINIMUM_SLOT_DIMENSION_MM);

      const placement: Placement = {
        cargoIndex,
        instanceIndex,
        containerId: container.id,
        position: [candidate.x, candidate.y, candidate.z],
        rotation: [0, candidate.variant.rotationY, 0],
      };

      placed.push({ cargoIndex, instanceIndex, placement, occupiedAabb });
    }
  }

  return { containerId: container.id, placed, unplaced };
}
