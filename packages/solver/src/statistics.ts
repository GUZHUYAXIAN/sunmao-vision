/**
 * statistics.ts — 装箱统计计算
 *
 * 纯函数：从放置结果聚合体积利用率、重量统计、扎带重量等。
 * 输出格式严格符合 SolveResultSchema.statistics 契约。
 */

import type {
  CargoTemplate,
  Container,
  ContainerStats,
  LashingConfig,
} from "@sunmao/contracts";
import { type Aabb, aabbVolume } from "./geometry";

// ─────────────────────────────────────────────
// 扎带重量估算
// ─────────────────────────────────────────────

/**
 * 估算本次装载所需的扎带总重量（kg）。
 *
 * 估算逻辑（简化模型，后续可替换为精确排布计算）：
 *   - 每件货物使用 2 根打包带（横向 + 纵向各 1 根）
 *   - 每根打包带长度 = 货物周长的 1.5 倍（留余量）
 *   - 拉紧器每 5 件货物 1 个
 *   - selfWeight 单位为 g/m，需换算为 kg
 *
 * @param placedCount   - 已装入的货物实例数量
 * @param placedAabbs   - 对应已装货物的 AABB 列表
 * @param lashingConfig - 扎带规格配置
 */
export function estimateLashingWeight(
  placedCount: number,
  placedAabbs: ReadonlyArray<Aabb>,
  lashingConfig: LashingConfig | undefined,
): number {
  // 未配置扎带规格时，扎带重量为 0
  if (lashingConfig === undefined) return 0;
  if (placedCount === 0) return 0;

  const strapping = lashingConfig.strapping;
  const tieDown = lashingConfig.tieDown;

  let totalLashingWeightGrams = 0;

  for (const aabb of placedAabbs) {
    const itemLength = aabb.maxX - aabb.minX;
    const itemHeight = aabb.maxY - aabb.minY;
    const itemWidth = aabb.maxZ - aabb.minZ;

    // 两根打包带：一根绕横截面，一根绕纵截面
    const strapLengthPerItem =
      2 * (itemHeight + itemWidth) * 1.5 + // 横向打包带
      2 * (itemHeight + itemLength) * 1.5; // 纵向打包带

    // selfWeight 单位: g/m，换算 mm → m：除以 1000
    totalLashingWeightGrams += (strapLengthPerItem / 1000) * strapping.selfWeight;
  }

  // 拉紧器重量：每 5 件一个，以固定重量计（selfWeight 字段表示 g/m，以 1m 长度估算）
  const tieDownCount = Math.ceil(placedCount / 5);
  totalLashingWeightGrams += tieDownCount * tieDown.selfWeight * 1; // 假设每个拉紧器带长 1m

  return totalLashingWeightGrams / 1000; // 换算为 kg
}

// ─────────────────────────────────────────────
// 单集装箱统计
// ─────────────────────────────────────────────

/**
 * 计算单个集装箱的装载统计数据。
 *
 * @param containerId     - 集装箱 ID
 * @param container       - 集装箱规格
 * @param placedItems     - 成功放置的货物项
 * @param placedAabbs     - 对应 placedItems 的 AABB（顺序一致）
 * @param templateMap     - cargoIndex → CargoTemplate 查找表
 * @param lashingConfig   - 扎带配置
 */
export function computeContainerStats(
  containerId: string,
  container: Container,
  placedItems: ReadonlyArray<{ cargoIndex: number }>,
  placedAabbs: ReadonlyArray<Aabb>,
  templateMap: ReadonlyMap<number, CargoTemplate>,
  lashingConfig: LashingConfig | undefined,
): ContainerStats {
  const itemCount = placedItems.length;

  let netWeight = 0;
  let usedVolume = 0;

  for (let itemIdx = 0; itemIdx < placedItems.length; itemIdx++) {
    const item = placedItems[itemIdx];
    const template = templateMap.get(item.cargoIndex);
    const aabb = placedAabbs[itemIdx];

    if (template !== undefined) {
      netWeight += template.weight;
    }
    if (aabb !== undefined) {
      usedVolume += aabbVolume(aabb);
    }
  }

  const lashingWeight = estimateLashingWeight(itemCount, placedAabbs, lashingConfig);

  const grossWeight = netWeight + lashingWeight + container.tareWeight;

  const containerVolume = container.length * container.height * container.width;
  const utilization = containerVolume > 0 ? (usedVolume / containerVolume) * 100 : 0;

  return {
    containerId,
    itemCount,
    netWeight: Math.round(netWeight * 10) / 10,
    lashingWeight: Math.round(lashingWeight * 10) / 10,
    grossWeight: Math.round(grossWeight * 10) / 10,
    utilization: Math.round(utilization * 10) / 10,
  };
}

// ─────────────────────────────────────────────
// 全局汇总
// ─────────────────────────────────────────────

/**
 * 汇总所有集装箱的统计数据，生成全局统计。
 *
 * @param perContainer - 各集装箱的 ContainerStats 列表
 * @param allContainers - 集装箱列表（用于计算总体积）
 */
export function computeGlobalStats(
  perContainer: ReadonlyArray<ContainerStats>,
  allContainers: ReadonlyArray<Container>,
): {
  totalNetWeight: number;
  totalGrossWeight: number;
  overallUtilization: number;
} {
  const totalNetWeight = perContainer.reduce((sum, stats) => sum + stats.netWeight, 0);
  const totalGrossWeight = perContainer.reduce((sum, stats) => sum + stats.grossWeight, 0);

  const totalContainerVolume = allContainers.reduce(
    (sum, container) => sum + container.length * container.height * container.width,
    0,
  );

  const totalUsedVolume = perContainer.reduce((sum, stats, index) => {
    const container = allContainers[index];
    if (container === undefined) return sum;
    const containerVolume = container.length * container.height * container.width;
    return sum + (containerVolume * stats.utilization) / 100;
  }, 0);

  const overallUtilization =
    totalContainerVolume > 0 ? (totalUsedVolume / totalContainerVolume) * 100 : 0;

  return {
    totalNetWeight: Math.round(totalNetWeight * 10) / 10,
    totalGrossWeight: Math.round(totalGrossWeight * 10) / 10,
    overallUtilization: Math.round(overallUtilization * 10) / 10,
  };
}
