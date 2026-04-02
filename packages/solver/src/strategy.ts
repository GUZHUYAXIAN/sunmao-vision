/**
 * strategy.ts — 可插拔放置策略接口
 *
 * 策略模式（Strategy Pattern）将放置算法与求解主流程解耦。
 * 所有策略实现必须是纯函数封装（无副作用、无 UI 依赖）。
 *
 * 坐标系：右手，Y 轴向上，单位 mm。
 * 位置定义：返回的 position 是货物 AABB 的最小角（左下前角）。
 */

import type { Aabb, FreeSlot, Vec3 } from "./geometry";

// ─────────────────────────────────────────────
// 策略输入/输出类型
// ─────────────────────────────────────────────

/** 货物单件的物理参数（与 CargoTemplate["dimensions"] 对齐） */
export type ItemDimensions = {
  readonly length: number;
  readonly width: number;
  readonly height: number;
  readonly weight: number;
};

/** 容器物理参数（只读视图，策略不得修改） */
export type ContainerDimensions = {
  readonly length: number;
  readonly width: number;
  readonly height: number;
};

/** 策略返回的放置决策 */
export type PlacementDecision = {
  /** 放置位置（AABB 最小角，mm） */
  readonly position: Vec3;
  /** 旋转角度 [rotX, rotY, rotZ]，当前仅 rotY 有意义（0 或 90） */
  readonly rotation: Vec3;
  /** 在 freeSlots 数组中被选中的槽索引（-1 若策略不依赖槽） */
  readonly slotIndex: number;
};

// ─────────────────────────────────────────────
// 策略接口
// ─────────────────────────────────────────────

/**
 * 可插拔装箱放置策略接口。
 *
 * 每种策略封装一种"如何在可用空间中为货物找到最优落点"的算法。
 * 当前内置策略：
 *   - GuillotinePlacementStrategy — 基于自由槽列表的 Guillotine 切割
 *   - SpiralPlacementStrategy    — 从中心向外的螺旋搜索（层优先）
 *
 * 外部可通过实现此接口并传入 `solve()` 来替换默认算法。
 */
export interface PlacementStrategy {
  /** 策略唯一标识名，用于调试和日志 */
  readonly name: string;

  /**
   * 在给定的可用空间中，为一件货物选择最佳放置位置。
   *
   * @param item               - 货物的物理参数（尺寸 + 重量）
   * @param freeSlots          - 当前可用自由槽列表（Guillotine 策略）或空数组（螺旋策略）
   * @param containerDimensions - 集装箱内腔尺寸
   * @param existingPlacements  - 已放置货物的 AABB 列表（碰撞检测用）
   * @param allowRotation      - 是否允许绕 Y 轴 90° 旋转
   * @returns 放置决策，或 null（容器内无合法位置）
   */
  findBestPlacement(
    item: ItemDimensions,
    freeSlots: FreeSlot[],
    containerDimensions: ContainerDimensions,
    existingPlacements: Aabb[],
    allowRotation: boolean,
  ): PlacementDecision | null;

  /**
   * 放置成功后，通知策略更新其内部自由空间状态。
   *
   * Guillotine 策略通过此回调执行槽切割。
   * 螺旋策略可在此处记录已占用区域以优化后续搜索。
   *
   * @param occupied      - 刚刚被占用的空间区域（FreeSlot 格式的坐标+尺寸）
   * @param currentSlots  - 当前自由槽列表（需要更新时由策略返回新列表）
   * @returns 更新后的自由槽列表（若策略不维护槽列表，返回 currentSlots 原值）
   */
  afterPlacement(
    occupied: FreeSlot,
    currentSlots: FreeSlot[],
    containerDimensions: ContainerDimensions,
  ): FreeSlot[];
}

// ─────────────────────────────────────────────
// 策略注册表（可选：运行时按名称查找策略）
// ─────────────────────────────────────────────

const strategyRegistry = new Map<string, PlacementStrategy>();

/**
 * 注册一个放置策略，使其可以通过名称在运行时动态选取。
 *
 * @example
 * registerStrategy(new GuillotinePlacementStrategy());
 * registerStrategy(new SpiralPlacementStrategy());
 */
export function registerStrategy(strategy: PlacementStrategy): void {
  strategyRegistry.set(strategy.name, strategy);
}

/**
 * 按名称获取已注册的放置策略。
 * 若策略未注册则返回 null。
 */
export function getStrategy(name: string): PlacementStrategy | null {
  return strategyRegistry.get(name) ?? null;
}

/** 获取所有已注册策略的名称列表 */
export function listStrategies(): string[] {
  return [...strategyRegistry.keys()];
}
