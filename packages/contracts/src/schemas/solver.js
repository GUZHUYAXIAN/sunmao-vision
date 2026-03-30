/**
 * 求解器输入/输出数据契约
 *
 * SolveRequest  — 提交给求解器的输入（类比 FEA .inp 文件）
 * SolveResult   — 求解器返回的结果（类比 FEA .odb 文件）
 *
 * 子类型：
 *   Placement           — 单个货物的放置结果
 *   LashingStrap         — 单条扎带的固定路径
 *   ContainerLashingPlan — 单个集装箱的扎带方案
 *   ContainerStats       — 单个集装箱的统计数据
 *   Warning              — 求解警告信息
 */
import { z } from "zod";
import { ContainerSchema } from "./container";
import { CargoTemplateSchema } from "./cargo";
import { LashingPresetSchema } from "./lashing";
// ============================================================
// 求解约束条件
// ============================================================
export const SolveConstraintsSchema = z.object({
    /** 是否允许旋转货物 */
    allowRotation: z.boolean().default(true),
    /** 是否检测重心稳定性 */
    gravityCheck: z.boolean().default(true),
    /** 最大堆叠层数（不限则不填） */
    maxStackLayers: z.number().int().min(1).optional(),
});
// ============================================================
// 扎带配置
// ============================================================
export const LashingConfigSchema = z.object({
    /** 选择的打包带规格 */
    strapping: LashingPresetSchema,
    /** 选择的拉紧器规格 */
    tieDown: LashingPresetSchema,
});
// ============================================================
// SolveRequest（求解请求）
// ============================================================
export const SolveRequestSchema = z.object({
    /** 至少一个集装箱 */
    containers: z.array(ContainerSchema).min(1),
    /** 至少一种货物 */
    cargoList: z.array(CargoTemplateSchema).min(1),
    /** 扎带配置 */
    lashing: LashingConfigSchema,
    /** 求解约束条件 */
    constraints: SolveConstraintsSchema,
});
// ============================================================
// Placement（放置结果）
// ============================================================
export const PlacementSchema = z.object({
    /** 对应 cargoList 中的序号 */
    cargoIndex: z.number().int().nonnegative(),
    /** 该种货物的第几个实例 */
    instanceIndex: z.number().int().nonnegative(),
    /** 放入的集装箱 ID */
    containerId: z.string().uuid(),
    /** [x, y, z] 坐标 (mm)，AABB 最小角 */
    position: z.tuple([z.number(), z.number(), z.number()]),
    /** [rx, ry, rz] 旋转角度 (度) */
    rotation: z.tuple([z.number(), z.number(), z.number()]),
});
// ============================================================
// 扎带方案
// ============================================================
export const LashingStrapSchema = z.object({
    /** 扎带类型 */
    type: z.enum(["strapping", "tieDown"]),
    /** 使用的规格代号 */
    presetCode: z.string(),
    /** 扎带起点坐标 [x,y,z] (mm) */
    fromPoint: z.tuple([z.number(), z.number(), z.number()]),
    /** 扎带终点坐标 [x,y,z] (mm) */
    toPoint: z.tuple([z.number(), z.number(), z.number()]),
    /** 被固定的货物实例 ID 列表 */
    securedItems: z.array(z.string().uuid()),
});
export const ContainerLashingPlanSchema = z.object({
    /** 集装箱 ID */
    containerId: z.string().uuid(),
    /** 该集装箱内的所有扎带 */
    straps: z.array(LashingStrapSchema),
});
// ============================================================
// 统计数据
// ============================================================
export const ContainerStatsSchema = z.object({
    /** 集装箱 ID */
    containerId: z.string().uuid(),
    /** 装入货物数量 */
    itemCount: z.number().int().nonnegative(),
    /** 净重 = 纯货物重量 (kg) */
    netWeight: z.number().nonnegative(),
    /** 扎带总重 (kg) */
    lashingWeight: z.number().nonnegative(),
    /** 毛重 = 货物 + 扎带 + 集装箱皮重 (kg) */
    grossWeight: z.number().nonnegative(),
    /** 体积利用率 (0-100%) */
    utilization: z.number().min(0).max(100),
});
// ============================================================
// 警告信息
// ============================================================
export const WarningSchema = z.object({
    /** 警告代码 */
    code: z.string(),
    /** 警告消息 */
    message: z.string(),
    /** 严重程度 */
    severity: z.enum(["info", "warning", "error"]),
    /** 相关货物 ID 列表 */
    relatedItems: z.array(z.string().uuid()).optional(),
});
// ============================================================
// SolveResult（求解结果）
// ============================================================
export const SolveResultSchema = z.object({
    /** 求解是否成功 */
    success: z.boolean(),
    /** 放置结果列表 */
    placements: z.array(PlacementSchema),
    /** 未能放置的货物列表 */
    unplacedItems: z.array(z.object({
        /** 对应 cargoList 中的序号 */
        cargoIndex: z.number().int().nonnegative(),
        /** 未放置原因 */
        reason: z.string(),
    })),
    /** 扎带固定方案 */
    lashingPlan: z.array(ContainerLashingPlanSchema),
    /** 统计数据 */
    statistics: z.object({
        /** 每个集装箱的统计 */
        perContainer: z.array(ContainerStatsSchema),
        /** 全部集装箱的总净重 (kg) */
        totalNetWeight: z.number().nonnegative(),
        /** 全部集装箱的总毛重 (kg) */
        totalGrossWeight: z.number().nonnegative(),
        /** 总体积利用率 (0-100%) */
        overallUtilization: z.number().min(0).max(100),
    }),
    /** 警告列表 */
    warnings: z.array(WarningSchema),
    /** 求解完成时间 */
    solvedAt: z.string().datetime(),
    /** 求解耗时 (毫秒) */
    solveTimeMs: z.number().nonnegative(),
});
//# sourceMappingURL=solver.js.map