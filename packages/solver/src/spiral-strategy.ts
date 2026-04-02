/**
 * spiral-strategy.ts — 从中心向外的螺旋搜索放置策略
 *
 * 基于旧版 BoxStack/autoStack.js §6.2 描述的螺旋搜索算法迁移而来，
 * 剥离了全部 Three.js / Cannon.js 渲染/物理依赖，实现为纯函数策略。
 *
 * 算法核心思想（来自旧版 autoStack.js L60-L130）：
 *   1. 将集装箱底层划分为网格（步长 = gridStep）
 *   2. 从底层中心点开始，按"螺旋环"逐步向外展开搜索
 *   3. 对每个候选网格格点，检查是否能放置当前货物（无碰撞 + 在边界内）
 *   4. 同层填满后，沿 Y 轴升一层继续搜索（层优先）
 *
 * 适用场景：
 *   - 货物尺寸不规则、大小混杂的场景（螺旋搜索比贪心槽切割更灵活）
 *   - 需要从容器中央开始堆叠（如圆形或不规则容器投影）
 *
 * 复杂度：O(n × L/g²)，其中 n 为货物数，L 为容器底面面积，g 为网格步长。
 * 建议网格步长不小于最小货物尺寸，否则性能显著下降。
 */

import {
  type Aabb,
  type FreeSlot,
  GEOMETRY_EPSILON_MM,
  getRotationVariants,
  hasAnyIntersection,
  isWithinContainer,
  makeAabb,
} from "./geometry";
import { hasSufficientBottomSupport } from "./weight-checker";
import type {
  ContainerDimensions,
  ItemDimensions,
  PlacementDecision,
  PlacementStrategy,
} from "./strategy";

// ─────────────────────────────────────────────
// 默认配置常量
// ─────────────────────────────────────────────

/** 默认网格搜索步长（mm）。建议设为最小货物尺寸的 1/2。 */
const DEFAULT_GRID_STEP_MM = 50;

/** 最大搜索层数上限（防止无限循环）。 */
const MAX_Y_LAYERS = 200;

// ─────────────────────────────────────────────
// 螺旋坐标生成器（纯函数）
// ─────────────────────────────────────────────

/**
 * 以 (centerX, centerZ) 为中心生成一圈螺旋环上的格点坐标。
 *
 * 螺旋环（Spiral Ring）定义：
 *   - 第 0 环：仅中心点 (0, 0)
 *   - 第 r 环：由 8 条边组成的"框"，每条边有 2r 个格点
 *
 * 坐标系：XZ 平面（水平面），Y 轴竖直向上不参与螺旋。
 *
 * @param ringRadius   - 环半径（格点数，0 = 中心）
 * @param centerX      - 中心 X（mm）
 * @param centerZ      - 中心 Z（mm）
 * @param gridStep     - 网格步长（mm）
 * @returns 当前环上所有格点的 (x, z) 坐标数组
 */
function getSpiralRingPoints(
  ringRadius: number,
  centerX: number,
  centerZ: number,
  gridStep: number,
): Array<[number, number]> {
  if (ringRadius === 0) {
    return [[centerX, centerZ]];
  }

  const points: Array<[number, number]> = [];
  const offset = ringRadius * gridStep;

  // 上边（从左到右，z = -offset）
  for (let ix = -ringRadius; ix <= ringRadius; ix++) {
    points.push([centerX + ix * gridStep, centerZ - offset]);
  }
  // 右边（从上到下，x = +offset，跳过角落）
  for (let iz = -ringRadius + 1; iz <= ringRadius; iz++) {
    points.push([centerX + offset, centerZ + iz * gridStep]);
  }
  // 下边（从右到左，z = +offset，跳过角落）
  for (let ix = ringRadius - 1; ix >= -ringRadius; ix--) {
    points.push([centerX + ix * gridStep, centerZ + offset]);
  }
  // 左边（从下到上，x = -offset，跳过两个角落）
  for (let iz = ringRadius - 1; iz > -ringRadius; iz--) {
    points.push([centerX - offset, centerZ + iz * gridStep]);
  }

  return points;
}

/**
 * 计算给定容器和货物尺寸下，螺旋搜索最多需要几个环（半径）。
 */
function computeMaxRingRadius(
  containerLength: number,
  containerWidth: number,
  gridStep: number,
): number {
  const halfL = containerLength / 2;
  const halfW = containerWidth / 2;
  return Math.ceil(Math.max(halfL, halfW) / gridStep) + 1;
}

// ─────────────────────────────────────────────
// 策略实现
// ─────────────────────────────────────────────

/** SpiralPlacementStrategy 的构造配置 */
export type SpiralStrategyConfig = {
  /**
   * 网格搜索步长（mm）。
   * 越小精度越高，但搜索节点数按平方增长，性能下降。
   * 建议设为最小货物尺寸的一半，默认 50mm。
   */
  readonly gridStepMm?: number;
};

/**
 * 螺旋搜索放置策略（层优先）。
 *
 * 特点：
 *   - 从底层（Y=0）开始，在每个 Y 层上执行螺旋搜索
 *   - 同层填满后，沿 Y 轴升到下一层继续
 *   - 不依赖 FreeSlot 列表（freeSlots 参数忽略）
 *   - 适合不规则尺寸货物、或需要重心集中在中央的场景
 *
 * 来源：旧版 BoxStack/autoStack.js 的核心算法提炼，
 * 去除了 Three.js 全局变量依赖，重写为纯函数形式。
 */
export class SpiralPlacementStrategy implements PlacementStrategy {
  readonly name = "spiral";

  private readonly gridStep: number;

  constructor(config: SpiralStrategyConfig = {}) {
    this.gridStep = config.gridStepMm ?? DEFAULT_GRID_STEP_MM;
  }

  findBestPlacement(
    item: ItemDimensions,
    _freeSlots: FreeSlot[],
    containerDimensions: ContainerDimensions,
    existingPlacements: Aabb[],
    allowRotation: boolean,
  ): PlacementDecision | null {
    const { length: containerLength, height: containerHeight, width: containerWidth } = containerDimensions;

    const variants = getRotationVariants(item.length, item.height, item.width, allowRotation);

    const centerX = containerLength / 2;
    const centerZ = containerWidth / 2;
    const maxRing = computeMaxRingRadius(containerLength, containerWidth, this.gridStep);

    // 按 Y 层从低到高逐层搜索（层优先策略）
    for (let yLayer = 0; yLayer < MAX_Y_LAYERS; yLayer++) {
      const baseY = yLayer * this.gridStep;
      if (baseY >= containerHeight - GEOMETRY_EPSILON_MM) {
        break;
      }

      // 当前 Y 层从中心向外螺旋搜索
      for (let ring = 0; ring <= maxRing; ring++) {
        const candidates = getSpiralRingPoints(ring, centerX, centerZ, this.gridStep);

        for (const [baseX, baseZ] of candidates) {
          for (const variant of variants) {
            // 将候选点调整为货物最小角坐标（中心对齐 → 最小角）
            const x = baseX - variant.length / 2;
            const y = baseY;
            const z = baseZ - variant.width / 2;

            // 跳过负坐标出发点
            if (x < -GEOMETRY_EPSILON_MM || z < -GEOMETRY_EPSILON_MM) {
              continue;
            }

            const candidateAabb = makeAabb(x, y, z, variant.length, variant.height, variant.width);

            if (!isWithinContainer(candidateAabb, containerLength, containerHeight, containerWidth)) {
              continue;
            }

            if (hasAnyIntersection(candidateAabb, existingPlacements)) {
              continue;
            }

            if (!hasSufficientBottomSupport(candidateAabb, existingPlacements)) {
              continue;
            }

            return {
              position: [x, y, z],
              rotation: [0, variant.rotationY, 0],
              slotIndex: -1,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * 螺旋策略不维护 FreeSlot 列表，直接返回原始 currentSlots。
   * 碰撞状态通过 existingPlacements (Aabb[]) 跟踪。
   */
  afterPlacement(
    _occupied: FreeSlot,
    currentSlots: FreeSlot[],
    _containerDimensions: ContainerDimensions,
  ): FreeSlot[] {
    return currentSlots;
  }
}
