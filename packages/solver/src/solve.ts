/**
 * solve.ts — 求解引擎顶层入口
 *
 * 唯一对外暴露的核心函数：`solve(request: SolveRequest): SolveResult`
 *
 * 职责：
 *   1. 将 SolveRequest 中的货物按排序策略展开（quantity 展开为 N 个实例）
 *   2. 为每个集装箱依次调用放置引擎
 *   3. 聚合多集装箱的放置结果
 *   4. 执行重量/重心校验，收集 Warning
 *   5. 计算统计数据
 *   6. 封装并返回符合 SolveResultSchema 的结果
 *
 * 本函数是纯函数：相同输入始终返回相同输出，无 I/O 操作，无全局状态。
 * 输入、输出均由 Zod 契约保护（调用方负责在调用前 parse，调用后可 safeParse 验证）。
 */

import {
  SolveRequestSchema,
  SolveResultSchema,
  type CargoTemplate,
  type Placement,
  type SolveRequest,
  type SolveResult,
} from "@sunmao/contracts";

import { type Aabb } from "./geometry";
import { type EngineConfig, packIntoContainer } from "./placement-engine";
import { sortCargoByVolumeAndWeight } from "./sorting";
import { computeContainerStats, computeGlobalStats } from "./statistics";
import {
  checkGravityStability,
  checkPayloadCompliance,
  computeCenterOfGravity,
} from "./weight-checker";

// ─────────────────────────────────────────────
// 内部辅助类型
// ─────────────────────────────────────────────

/** 带 cargoIndex 的货物条目，用于追溯放置结果 */
type IndexedCargo = {
  readonly template: CargoTemplate;
  readonly quantity: number;
  readonly cargoIndex: number;
};

// ─────────────────────────────────────────────
// 主求解函数
// ─────────────────────────────────────────────

/**
 * 三维集装箱装载规划求解函数。
 *
 * @param request - 经过验证的求解请求（建议调用方先用 SolveRequestSchema.parse() 验证）
 * @returns SolveResult — 完整求解结果，可直接用 SolveResultSchema.parse() 验证
 *
 * @throws 不主动抛出异常；内部错误会降级为 `success: false` + warnings 报告
 */
export function solve(request: SolveRequest): SolveResult {
  const startTime = Date.now();

  // Step 1: 按排序策略对货物排序
  const sortedTemplates = sortCargoByVolumeAndWeight(request.cargoList);

  // Step 2: 构建带 cargoIndex 的条目（cargoIndex 指向原始 cargoList 的位置）
  const indexedCargo: IndexedCargo[] = sortedTemplates.map((template) => {
    const originalIndex = request.cargoList.findIndex(
      (original: CargoTemplate) => original.id === template.id,
    );
    return {
      template,
      quantity: template.quantity,
      cargoIndex: originalIndex,
    };
  });

  // Step 3: 逐集装箱执行放置
  const allPlacements: Placement[] = [];
  const allPlacedAabbs: Aabb[] = [];
  const allUnplaced: SolveResult["unplacedItems"] = [];
  const allWarnings: SolveResult["warnings"] = [];

  // 构建 templateMap 供后续校验函数使用
  const templateMap = new Map<number, CargoTemplate>(
    request.cargoList.map(
      (template: CargoTemplate, index: number): [number, CargoTemplate] => [index, template],
    ),
  );

  // 待处理货物列表（多箱时，上一箱未放完的货物继续在下一箱尝试）
  let remainingCargo: IndexedCargo[] = [...indexedCargo];

  const perContainerStats: ReturnType<typeof computeContainerStats>[] = [];

  for (const container of request.containers) {
    if (remainingCargo.length === 0) break;

    const engineConfig: EngineConfig = {
      containerLength: container.length,
      containerHeight: container.height,
      containerWidth: container.width,
      allowRotation: request.constraints.allowRotation,
      maxStackLayers: request.constraints.maxStackLayers,
    };

    const packResult = packIntoContainer(remainingCargo, container, engineConfig);

    // 汇聚本箱放置成功的记录
    const containerPlacements: Placement[] = [];
    const containerAabbs: Aabb[] = [];
    const containerPlacedItems: { cargoIndex: number; instanceIndex: number }[] = [];

    for (const placedItem of packResult.placed) {
      allPlacements.push(placedItem.placement);
      allPlacedAabbs.push(placedItem.occupiedAabb);
      containerPlacements.push(placedItem.placement);
      containerAabbs.push(placedItem.occupiedAabb);
      containerPlacedItems.push({
        cargoIndex: placedItem.cargoIndex,
        instanceIndex: placedItem.instanceIndex,
      });
    }

    // 重量合规校验
    const payloadWarnings = checkPayloadCompliance(
      containerPlacedItems,
      templateMap,
      container,
    );
    allWarnings.push(...payloadWarnings);

    // 重心稳定性校验
    if (request.constraints.gravityCheck) {
      const cog = computeCenterOfGravity(containerPlacements, containerAabbs, templateMap);
      if (cog !== null) {
        const cogWarnings = checkGravityStability(cog, container, true);
        allWarnings.push(...cogWarnings);
      }
    }

    // 统计
    const stats = computeContainerStats(
      container.id,
      container,
      containerPlacedItems,
      containerAabbs,
      templateMap,
      request.lashing,
    );
    perContainerStats.push(stats);

    // 对每种货物，按其 unplaced 数量计算剩余待放数量，留给下一个集装箱继续尝试
    const nextRemaining: IndexedCargo[] = [];
    for (const cargo of remainingCargo) {
      const unplacedInstanceCount = packResult.unplaced.filter(
        (unplacedItem) => unplacedItem.cargoIndex === cargo.cargoIndex,
      ).length;

      if (unplacedInstanceCount > 0) {
        nextRemaining.push({ ...cargo, quantity: unplacedInstanceCount });
      }
    }

    remainingCargo = nextRemaining;
  }

  // 剩余未放入任何集装箱的货物，全部标记为 unplaced
  for (const leftover of remainingCargo) {
    for (let instanceIdx = 0; instanceIdx < leftover.quantity; instanceIdx++) {
      allUnplaced.push({
        cargoIndex: leftover.cargoIndex,
        reason: "所有集装箱均已尝试，无法放置本货物（空间不足或超重）",
      });
    }
  }

  // 若存在 unplaced 货物，产生汇总警告
  if (allUnplaced.length > 0) {
    allWarnings.push({
      code: "ITEMS_UNPLACED",
      message: `共有 ${allUnplaced.length} 件货物无法装入集装箱，请检查集装箱数量或货物尺寸配置。`,
      severity: "error",
    });
  }

  // 全局统计汇总
  const globalStats = computeGlobalStats(perContainerStats, request.containers);

  const solveTimeMs = Date.now() - startTime;

  const result: SolveResult = {
    success: allUnplaced.length === 0,
    placements: allPlacements,
    unplacedItems: allUnplaced,
    lashingPlan: [], // M3 里程碑实现：扎带路径规划
    statistics: {
      perContainer: perContainerStats,
      totalNetWeight: globalStats.totalNetWeight,
      totalGrossWeight: globalStats.totalGrossWeight,
      overallUtilization: globalStats.overallUtilization,
    },
    warnings: allWarnings,
    solvedAt: new Date().toISOString(),
    solveTimeMs,
  };

  return result;
}

// ─────────────────────────────────────────────
// Zod 保护的安全入口（推荐在 API 层使用此函数）
// ─────────────────────────────────────────────

/**
 * 带输入/输出双重 Zod 验证的安全求解入口。
 *
 * 推荐在 API 路由层调用此函数，确保边界数据完整性。
 *
 * @param rawInput - 未验证的原始请求体（来自 HTTP 请求等外部来源）
 * @returns 包含验证状态的结果
 */
export function safeSolve(rawInput: unknown):
  | { ok: true; result: SolveResult }
  | { ok: false; error: string } {
  const parseResult = SolveRequestSchema.safeParse(rawInput);

  if (!parseResult.success) {
    const errorMessages = parseResult.error.errors
      .map((zodError: { path: (string | number)[]; message: string }) =>
        `${zodError.path.join(".")}: ${zodError.message}`
      )
      .join("; ");
    return { ok: false, error: `输入验证失败: ${errorMessages}` };
  }

  const result = solve(parseResult.data);

  const outputParseResult = SolveResultSchema.safeParse(result);
  if (!outputParseResult.success) {
    return { ok: false, error: "内部错误：求解结果不符合输出契约，请联系开发团队" };
  }

  return { ok: true, result: outputParseResult.data };
}

