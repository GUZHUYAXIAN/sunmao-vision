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
import { type Aabb, type FreeSlot, GEOMETRY_EPSILON_MM, makeAabb } from "./geometry";
import type { PlacementStrategy } from "./strategy";
import { GuillotinePlacementStrategy } from "./guillotine-strategy";

// ─────────────────────────────────────────────
// 内部类型
// ─────────────────────────────────────────────


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
// 公开入口
// ─────────────────────────────────────────────


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
  /**
   * 可插拔放置策略。
   * 不传时默认使用 GuillotinePlacementStrategy（延迟注入，避免循环依赖）。
   */
  strategy?: PlacementStrategy,
): ContainerPackResult {
  const { length: containerLength, height: containerHeight, width: containerWidth } = container;

  // strategy 未传时使用 GuillotinePlacement 作为默认策略
  const activeStrategy: PlacementStrategy = strategy ?? new GuillotinePlacementStrategy();

  const containerDimensions = {
    length: containerLength,
    height: containerHeight,
    width: containerWidth,
  };

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

      // ── 策略：寻找最佳放置位置 ────────────────────────────────────
      const itemDimensions = {
        length: template.dimensions.length,
        height: template.dimensions.height,
        width: template.dimensions.width,
        weight: template.weight,
      };

      const decision = activeStrategy.findBestPlacement(
        itemDimensions,
        activeFreeSlots,
        containerDimensions,
        occupiedAabbs,
        config.allowRotation,
      );

      if (decision === null) {
        unplaced.push({
          cargoIndex,
          instanceIndex,
          reason: "集装箱内无足够连续且受支撑的空间可放置本货物",
        });
        continue;
      }

      const [posX, posY, posZ] = decision.position;
      const [, rotY] = decision.rotation;

      // 根据旋转决策还原实际最终尺寸
      const isRotated = rotY !== 0;
      const finalLength = isRotated ? template.dimensions.width : template.dimensions.length;
      const finalHeight = template.dimensions.height;
      const finalWidth = isRotated ? template.dimensions.length : template.dimensions.width;

      const occupiedAabb = makeAabb(posX, posY, posZ, finalLength, finalHeight, finalWidth);

      occupiedAabbs.push(occupiedAabb);
      currentTotalWeight += template.weight;

      const occupiedSlot: FreeSlot = {
        x: posX,
        y: posY,
        z: posZ,
        length: finalLength,
        height: finalHeight,
        width: finalWidth,
      };

      // ── 策略：放置后更新自由空间 ─────────────────────────────────────
      freeSlots = activeStrategy.afterPlacement(occupiedSlot, freeSlots, containerDimensions);

      const placement: Placement = {
        cargoIndex,
        instanceIndex,
        containerId: container.id,
        position: [posX, posY, posZ],
        rotation: [0, rotY, 0],
      };

      placed.push({ cargoIndex, instanceIndex, placement, occupiedAabb });
    }
  }

  return { containerId: container.id, placed, unplaced };
}
