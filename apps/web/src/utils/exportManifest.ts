/**
 * exportManifest.ts — 将求解结果转换为 ExportManifest 导出契约
 *
 * 纯函数：从 project + solveResult 构建符合 ExportManifestSchema 的
 * 导出清单，供 Excel 导出等下游消费。构建结果通过契约校验后方可使用。
 *
 * 条目粒度：每个已放置的货物实例一行（quantity = 1），保证坐标
 * 描述逐件准确；同模板多实例不合并，避免坐标信息丢失。
 */

import {
  ExportManifestSchema,
  findLashingPreset,
  type ContainerManifest,
  type ExportManifest,
  type SolveRequest,
  type SolveResult,
} from "@sunmao/contracts";

/** LashingStrap.type → 导出清单中的扎带类型显示名 */
const STRAP_TYPE_LABELS: Record<string, string> = {
  strapping: "打包带",
  tieDown: "拉紧器",
};

/** 统计数字保留 1 位小数（与 solver statistics 精度一致） */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * 构建单个集装箱的装箱清单。
 *
 * @param container       - 集装箱配置（取名称/规格/皮重）
 * @param solveResult     - 求解结果（placements / lashingPlan / statistics）
 * @param cargoList       - 项目货物模板列表（按 cargoIndex 索引）
 */
function buildContainerManifest(
  container: SolveRequest["containers"][number],
  solveResult: SolveResult,
  cargoList: SolveRequest["cargoList"],
): ContainerManifest | null {
  const placements = solveResult.placements.filter(
    (placement) => placement.containerId === container.id,
  );
  // 空箱不出现在导出清单中
  if (placements.length === 0) return null;

  const items = placements.map((placement) => {
    const cargo = cargoList[placement.cargoIndex];
    const [x, y, z] = placement.position;
    const { length, width, height } = cargo.dimensions;

    return {
      id: `cargo_${placement.cargoIndex}_${placement.instanceIndex}`,
      name: cargo.displayName,
      quantity: 1,
      unitWeight: cargo.weight,
      totalWeight: cargo.weight,
      dimensions: `${length}×${width}×${height}`,
      position: `(${x}, ${y}, ${z})`,
    };
  });

  // 扎带用量：按 类型 + 规格代号 分组计数
  const plan = solveResult.lashingPlan.find((entry) => entry.containerId === container.id);
  const lashingUsed: ContainerManifest["lashingUsed"] = [];
  if (plan) {
    const countByPreset = new Map<string, number>();
    for (const strap of plan.straps) {
      countByPreset.set(strap.presetCode, (countByPreset.get(strap.presetCode) ?? 0) + 1);
    }
    for (const [presetCode, count] of countByPreset) {
      const preset = findLashingPreset(presetCode);
      const strapType = plan.straps.find((strap) => strap.presetCode === presetCode)?.type;
      lashingUsed.push({
        type: STRAP_TYPE_LABELS[strapType ?? ""] ?? "其他",
        specification: preset ? preset.name : presetCode,
        quantityOrLength: `${count} 根`,
      });
    }
  }

  const stats = solveResult.statistics.perContainer.find(
    (entry) => entry.containerId === container.id,
  );
  const netWeight = round1(items.reduce((sum, item) => sum + item.totalWeight, 0));

  return {
    containerName: container.name,
    containerSpec: `${container.length}×${container.width}×${container.height}`,
    tareWeight: container.tareWeight,
    items,
    lashingUsed,
    summary: {
      itemCount: items.length,
      netWeight,
      lashingWeight: stats?.lashingWeight ?? 0,
      grossWeight: stats?.grossWeight ?? round1(netWeight + container.tareWeight),
      utilization: stats?.utilization ?? 0,
    },
  };
}

/**
 * 构建完整的导出清单（符合 ExportManifestSchema）。
 *
 * @param project     - 求解请求（集装箱 + 货物模板）
 * @param solveResult - 求解结果
 * @returns 校验通过的 ExportManifest；若结果不符合契约则抛出 Error
 */
export function buildExportManifest(
  project: SolveRequest,
  solveResult: SolveResult,
): ExportManifest {
  const containers = project.containers
    .map((container) => buildContainerManifest(container, solveResult, project.cargoList))
    .filter((manifest): manifest is ContainerManifest => manifest !== null);

  const manifest: ExportManifest = {
    projectName: "榫卯视界 — 装箱清单",
    exportedAt: new Date().toISOString(),
    containers,
    grandTotal: {
      totalContainers: containers.length,
      totalItems: containers.reduce((sum, entry) => sum + entry.summary.itemCount, 0),
      totalNetWeight: round1(containers.reduce((sum, entry) => sum + entry.summary.netWeight, 0)),
      totalGrossWeight: round1(
        containers.reduce((sum, entry) => sum + entry.summary.grossWeight, 0),
      ),
    },
  };

  // 出口契约自检：构建结果必须能通过导出契约校验
  return ExportManifestSchema.parse(manifest);
}
