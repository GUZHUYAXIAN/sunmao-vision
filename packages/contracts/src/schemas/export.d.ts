/**
 * 导出相关数据契约
 *
 * ManifestItem        — 装箱清单中的单个货物条目
 * ContainerManifest   — 单个集装箱的装箱清单
 * ExportManifest      — 完整的导出清单（用于生成 Excel）
 */
import { z } from "zod";
export declare const ManifestItemSchema: z.ZodObject<{
    /** 货物 ID */
    id: z.ZodString;
    /** 货物名称 */
    name: z.ZodString;
    /** 数量 */
    quantity: z.ZodNumber;
    /** 单重 (kg) */
    unitWeight: z.ZodNumber;
    /** 总重 = 单重 × 数量 (kg) */
    totalWeight: z.ZodNumber;
    /** 尺寸描述，如 "800×500×300" */
    dimensions: z.ZodString;
    /** 放置坐标描述 */
    position: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    dimensions: string;
    quantity: number;
    position: string;
    name: string;
    unitWeight: number;
    totalWeight: number;
}, {
    id: string;
    dimensions: string;
    quantity: number;
    position: string;
    name: string;
    unitWeight: number;
    totalWeight: number;
}>;
export type ManifestItem = z.infer<typeof ManifestItemSchema>;
export declare const ContainerManifestSchema: z.ZodObject<{
    /** 集装箱名称 */
    containerName: z.ZodString;
    /** 规格描述, 如 "6058×2438×2591" */
    containerSpec: z.ZodString;
    /** 集装箱皮重 (kg) */
    tareWeight: z.ZodNumber;
    /** 货物条目列表 */
    items: z.ZodArray<z.ZodObject<{
        /** 货物 ID */
        id: z.ZodString;
        /** 货物名称 */
        name: z.ZodString;
        /** 数量 */
        quantity: z.ZodNumber;
        /** 单重 (kg) */
        unitWeight: z.ZodNumber;
        /** 总重 = 单重 × 数量 (kg) */
        totalWeight: z.ZodNumber;
        /** 尺寸描述，如 "800×500×300" */
        dimensions: z.ZodString;
        /** 放置坐标描述 */
        position: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        dimensions: string;
        quantity: number;
        position: string;
        name: string;
        unitWeight: number;
        totalWeight: number;
    }, {
        id: string;
        dimensions: string;
        quantity: number;
        position: string;
        name: string;
        unitWeight: number;
        totalWeight: number;
    }>, "many">;
    /** 扎带使用清单 */
    lashingUsed: z.ZodArray<z.ZodObject<{
        /** 扎带类型（打包带 / 拉紧器） */
        type: z.ZodString;
        /** 规格名称 */
        specification: z.ZodString;
        /** 使用数量或长度 */
        quantityOrLength: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: string;
        specification: string;
        quantityOrLength: string;
    }, {
        type: string;
        specification: string;
        quantityOrLength: string;
    }>, "many">;
    /** 汇总统计 */
    summary: z.ZodObject<{
        /** 货物总数 */
        itemCount: z.ZodNumber;
        /** 净重 (kg) */
        netWeight: z.ZodNumber;
        /** 扎带重量 (kg) */
        lashingWeight: z.ZodNumber;
        /** 毛重 (kg) */
        grossWeight: z.ZodNumber;
        /** 利用率 (0-100%) */
        utilization: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        itemCount: number;
        netWeight: number;
        lashingWeight: number;
        grossWeight: number;
        utilization: number;
    }, {
        itemCount: number;
        netWeight: number;
        lashingWeight: number;
        grossWeight: number;
        utilization: number;
    }>;
}, "strip", z.ZodTypeAny, {
    tareWeight: number;
    containerName: string;
    containerSpec: string;
    items: {
        id: string;
        dimensions: string;
        quantity: number;
        position: string;
        name: string;
        unitWeight: number;
        totalWeight: number;
    }[];
    lashingUsed: {
        type: string;
        specification: string;
        quantityOrLength: string;
    }[];
    summary: {
        itemCount: number;
        netWeight: number;
        lashingWeight: number;
        grossWeight: number;
        utilization: number;
    };
}, {
    tareWeight: number;
    containerName: string;
    containerSpec: string;
    items: {
        id: string;
        dimensions: string;
        quantity: number;
        position: string;
        name: string;
        unitWeight: number;
        totalWeight: number;
    }[];
    lashingUsed: {
        type: string;
        specification: string;
        quantityOrLength: string;
    }[];
    summary: {
        itemCount: number;
        netWeight: number;
        lashingWeight: number;
        grossWeight: number;
        utilization: number;
    };
}>;
export type ContainerManifest = z.infer<typeof ContainerManifestSchema>;
export declare const ExportManifestSchema: z.ZodObject<{
    /** 项目名称 */
    projectName: z.ZodString;
    /** 导出时间 */
    exportedAt: z.ZodString;
    /** 每个集装箱的清单 */
    containers: z.ZodArray<z.ZodObject<{
        /** 集装箱名称 */
        containerName: z.ZodString;
        /** 规格描述, 如 "6058×2438×2591" */
        containerSpec: z.ZodString;
        /** 集装箱皮重 (kg) */
        tareWeight: z.ZodNumber;
        /** 货物条目列表 */
        items: z.ZodArray<z.ZodObject<{
            /** 货物 ID */
            id: z.ZodString;
            /** 货物名称 */
            name: z.ZodString;
            /** 数量 */
            quantity: z.ZodNumber;
            /** 单重 (kg) */
            unitWeight: z.ZodNumber;
            /** 总重 = 单重 × 数量 (kg) */
            totalWeight: z.ZodNumber;
            /** 尺寸描述，如 "800×500×300" */
            dimensions: z.ZodString;
            /** 放置坐标描述 */
            position: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            dimensions: string;
            quantity: number;
            position: string;
            name: string;
            unitWeight: number;
            totalWeight: number;
        }, {
            id: string;
            dimensions: string;
            quantity: number;
            position: string;
            name: string;
            unitWeight: number;
            totalWeight: number;
        }>, "many">;
        /** 扎带使用清单 */
        lashingUsed: z.ZodArray<z.ZodObject<{
            /** 扎带类型（打包带 / 拉紧器） */
            type: z.ZodString;
            /** 规格名称 */
            specification: z.ZodString;
            /** 使用数量或长度 */
            quantityOrLength: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: string;
            specification: string;
            quantityOrLength: string;
        }, {
            type: string;
            specification: string;
            quantityOrLength: string;
        }>, "many">;
        /** 汇总统计 */
        summary: z.ZodObject<{
            /** 货物总数 */
            itemCount: z.ZodNumber;
            /** 净重 (kg) */
            netWeight: z.ZodNumber;
            /** 扎带重量 (kg) */
            lashingWeight: z.ZodNumber;
            /** 毛重 (kg) */
            grossWeight: z.ZodNumber;
            /** 利用率 (0-100%) */
            utilization: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            itemCount: number;
            netWeight: number;
            lashingWeight: number;
            grossWeight: number;
            utilization: number;
        }, {
            itemCount: number;
            netWeight: number;
            lashingWeight: number;
            grossWeight: number;
            utilization: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        tareWeight: number;
        containerName: string;
        containerSpec: string;
        items: {
            id: string;
            dimensions: string;
            quantity: number;
            position: string;
            name: string;
            unitWeight: number;
            totalWeight: number;
        }[];
        lashingUsed: {
            type: string;
            specification: string;
            quantityOrLength: string;
        }[];
        summary: {
            itemCount: number;
            netWeight: number;
            lashingWeight: number;
            grossWeight: number;
            utilization: number;
        };
    }, {
        tareWeight: number;
        containerName: string;
        containerSpec: string;
        items: {
            id: string;
            dimensions: string;
            quantity: number;
            position: string;
            name: string;
            unitWeight: number;
            totalWeight: number;
        }[];
        lashingUsed: {
            type: string;
            specification: string;
            quantityOrLength: string;
        }[];
        summary: {
            itemCount: number;
            netWeight: number;
            lashingWeight: number;
            grossWeight: number;
            utilization: number;
        };
    }>, "many">;
    /** 总计 */
    grandTotal: z.ZodObject<{
        /** 集装箱总数 */
        totalContainers: z.ZodNumber;
        /** 货物总数 */
        totalItems: z.ZodNumber;
        /** 总净重 (kg) */
        totalNetWeight: z.ZodNumber;
        /** 总毛重 (kg) */
        totalGrossWeight: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalNetWeight: number;
        totalGrossWeight: number;
        totalContainers: number;
        totalItems: number;
    }, {
        totalNetWeight: number;
        totalGrossWeight: number;
        totalContainers: number;
        totalItems: number;
    }>;
}, "strip", z.ZodTypeAny, {
    containers: {
        tareWeight: number;
        containerName: string;
        containerSpec: string;
        items: {
            id: string;
            dimensions: string;
            quantity: number;
            position: string;
            name: string;
            unitWeight: number;
            totalWeight: number;
        }[];
        lashingUsed: {
            type: string;
            specification: string;
            quantityOrLength: string;
        }[];
        summary: {
            itemCount: number;
            netWeight: number;
            lashingWeight: number;
            grossWeight: number;
            utilization: number;
        };
    }[];
    projectName: string;
    exportedAt: string;
    grandTotal: {
        totalNetWeight: number;
        totalGrossWeight: number;
        totalContainers: number;
        totalItems: number;
    };
}, {
    containers: {
        tareWeight: number;
        containerName: string;
        containerSpec: string;
        items: {
            id: string;
            dimensions: string;
            quantity: number;
            position: string;
            name: string;
            unitWeight: number;
            totalWeight: number;
        }[];
        lashingUsed: {
            type: string;
            specification: string;
            quantityOrLength: string;
        }[];
        summary: {
            itemCount: number;
            netWeight: number;
            lashingWeight: number;
            grossWeight: number;
            utilization: number;
        };
    }[];
    projectName: string;
    exportedAt: string;
    grandTotal: {
        totalNetWeight: number;
        totalGrossWeight: number;
        totalContainers: number;
        totalItems: number;
    };
}>;
export type ExportManifest = z.infer<typeof ExportManifestSchema>;
//# sourceMappingURL=export.d.ts.map