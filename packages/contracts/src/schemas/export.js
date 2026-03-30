/**
 * 导出相关数据契约
 *
 * ManifestItem        — 装箱清单中的单个货物条目
 * ContainerManifest   — 单个集装箱的装箱清单
 * ExportManifest      — 完整的导出清单（用于生成 Excel）
 */
import { z } from "zod";
// ============================================================
// ManifestItem（清单条目）
// ============================================================
export const ManifestItemSchema = z.object({
    /** 货物 ID */
    id: z.string(),
    /** 货物名称 */
    name: z.string(),
    /** 数量 */
    quantity: z.number().int().min(1),
    /** 单重 (kg) */
    unitWeight: z.number().nonnegative(),
    /** 总重 = 单重 × 数量 (kg) */
    totalWeight: z.number().nonnegative(),
    /** 尺寸描述，如 "800×500×300" */
    dimensions: z.string(),
    /** 放置坐标描述 */
    position: z.string(),
});
// ============================================================
// ContainerManifest（集装箱清单）
// ============================================================
export const ContainerManifestSchema = z.object({
    /** 集装箱名称 */
    containerName: z.string(),
    /** 规格描述, 如 "6058×2438×2591" */
    containerSpec: z.string(),
    /** 集装箱皮重 (kg) */
    tareWeight: z.number().nonnegative(),
    /** 货物条目列表 */
    items: z.array(ManifestItemSchema),
    /** 扎带使用清单 */
    lashingUsed: z.array(z.object({
        /** 扎带类型（打包带 / 拉紧器） */
        type: z.string(),
        /** 规格名称 */
        specification: z.string(),
        /** 使用数量或长度 */
        quantityOrLength: z.string(),
    })),
    /** 汇总统计 */
    summary: z.object({
        /** 货物总数 */
        itemCount: z.number().int().nonnegative(),
        /** 净重 (kg) */
        netWeight: z.number().nonnegative(),
        /** 扎带重量 (kg) */
        lashingWeight: z.number().nonnegative(),
        /** 毛重 (kg) */
        grossWeight: z.number().nonnegative(),
        /** 利用率 (0-100%) */
        utilization: z.number().min(0).max(100),
    }),
});
// ============================================================
// ExportManifest（完整导出清单）
// ============================================================
export const ExportManifestSchema = z.object({
    /** 项目名称 */
    projectName: z.string(),
    /** 导出时间 */
    exportedAt: z.string().datetime(),
    /** 每个集装箱的清单 */
    containers: z.array(ContainerManifestSchema),
    /** 总计 */
    grandTotal: z.object({
        /** 集装箱总数 */
        totalContainers: z.number().int().min(1),
        /** 货物总数 */
        totalItems: z.number().int().nonnegative(),
        /** 总净重 (kg) */
        totalNetWeight: z.number().nonnegative(),
        /** 总毛重 (kg) */
        totalGrossWeight: z.number().nonnegative(),
    }),
});
//# sourceMappingURL=export.js.map