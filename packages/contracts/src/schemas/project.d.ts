/**
 * 项目级别数据契约
 *
 * Project — 包含一个项目的全部信息（类比 FEA .cae 项目文件）
 */
import { z } from "zod";
export declare const ProjectSchema: z.ZodObject<{
    /** 唯一标识 */
    id: z.ZodString;
    /** 项目名称 */
    name: z.ZodString;
    /** 导入的模型列表 */
    models: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        fileName: z.ZodString;
        sourcePdf: z.ZodString;
        sourcePage: z.ZodNumber;
        filePath: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        fileName: string;
        sourcePdf: string;
        sourcePage: number;
        filePath: string;
        createdAt: string;
    }, {
        id: string;
        fileName: string;
        sourcePdf: string;
        sourcePage: number;
        filePath: string;
        createdAt: string;
    }>, "many">;
    /** 缩放标定记录 */
    scaleRecords: z.ZodArray<z.ZodObject<{
        modelId: z.ZodString;
        scaleFactors: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        realDimensions: z.ZodObject<{
            length: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            length: number;
            width: number;
            height: number;
        }, {
            length: number;
            width: number;
            height: number;
        }>;
        calibratedBy: z.ZodString;
        calibratedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        modelId: string;
        scaleFactors: [number, number, number];
        realDimensions: {
            length: number;
            width: number;
            height: number;
        };
        calibratedBy: string;
        calibratedAt: string;
    }, {
        modelId: string;
        scaleFactors: [number, number, number];
        realDimensions: {
            length: number;
            width: number;
            height: number;
        };
        calibratedBy: string;
        calibratedAt: string;
    }>, "many">;
    /** 货物模板列表 */
    templates: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        modelId: z.ZodString;
        displayName: z.ZodString;
        dimensions: z.ZodObject<{
            length: z.ZodNumber;
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            length: number;
            width: number;
            height: number;
        }, {
            length: number;
            width: number;
            height: number;
        }>;
        weight: z.ZodNumber;
        quantity: z.ZodNumber;
        color: z.ZodString;
        category: z.ZodOptional<z.ZodString>;
        density: z.ZodOptional<z.ZodNumber>;
        material: z.ZodOptional<z.ZodString>;
        price: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        modelId: string;
        displayName: string;
        dimensions: {
            length: number;
            width: number;
            height: number;
        };
        weight: number;
        quantity: number;
        color: string;
        category?: string | undefined;
        density?: number | undefined;
        material?: string | undefined;
        price?: number | undefined;
    }, {
        id: string;
        modelId: string;
        displayName: string;
        dimensions: {
            length: number;
            width: number;
            height: number;
        };
        weight: number;
        quantity: number;
        color: string;
        category?: string | undefined;
        density?: number | undefined;
        material?: string | undefined;
        price?: number | undefined;
    }>, "many">;
    /** 集装箱列表 */
    containers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        length: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
        maxPayload: z.ZodNumber;
        tareWeight: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        length: number;
        width: number;
        height: number;
        name: string;
        maxPayload: number;
        tareWeight: number;
    }, {
        id: string;
        length: number;
        width: number;
        height: number;
        name: string;
        maxPayload: number;
        tareWeight?: number | undefined;
    }>, "many">;
    /** 最新求解结果（可能尚未求解） */
    solveResult: z.ZodOptional<z.ZodObject<{
        success: z.ZodBoolean;
        placements: z.ZodArray<z.ZodObject<{
            cargoIndex: z.ZodNumber;
            instanceIndex: z.ZodNumber;
            containerId: z.ZodString;
            position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
            rotation: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        }, "strip", z.ZodTypeAny, {
            containerId: string;
            position: [number, number, number];
            rotation: [number, number, number];
            cargoIndex: number;
            instanceIndex: number;
        }, {
            containerId: string;
            position: [number, number, number];
            rotation: [number, number, number];
            cargoIndex: number;
            instanceIndex: number;
        }>, "many">;
        unplacedItems: z.ZodArray<z.ZodObject<{
            cargoIndex: z.ZodNumber;
            reason: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            cargoIndex: number;
            reason: string;
        }, {
            cargoIndex: number;
            reason: string;
        }>, "many">;
        lashingPlan: z.ZodArray<z.ZodObject<{
            containerId: z.ZodString;
            straps: z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<["strapping", "tieDown"]>;
                presetCode: z.ZodString;
                fromPoint: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                toPoint: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
                securedItems: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                type: "strapping" | "tieDown";
                presetCode: string;
                fromPoint: [number, number, number];
                toPoint: [number, number, number];
                securedItems: string[];
            }, {
                type: "strapping" | "tieDown";
                presetCode: string;
                fromPoint: [number, number, number];
                toPoint: [number, number, number];
                securedItems: string[];
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            containerId: string;
            straps: {
                type: "strapping" | "tieDown";
                presetCode: string;
                fromPoint: [number, number, number];
                toPoint: [number, number, number];
                securedItems: string[];
            }[];
        }, {
            containerId: string;
            straps: {
                type: "strapping" | "tieDown";
                presetCode: string;
                fromPoint: [number, number, number];
                toPoint: [number, number, number];
                securedItems: string[];
            }[];
        }>, "many">;
        statistics: z.ZodObject<{
            perContainer: z.ZodArray<z.ZodObject<{
                containerId: z.ZodString;
                itemCount: z.ZodNumber;
                netWeight: z.ZodNumber;
                lashingWeight: z.ZodNumber;
                grossWeight: z.ZodNumber;
                utilization: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                containerId: string;
                itemCount: number;
                netWeight: number;
                lashingWeight: number;
                grossWeight: number;
                utilization: number;
            }, {
                containerId: string;
                itemCount: number;
                netWeight: number;
                lashingWeight: number;
                grossWeight: number;
                utilization: number;
            }>, "many">;
            totalNetWeight: z.ZodNumber;
            totalGrossWeight: z.ZodNumber;
            overallUtilization: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            perContainer: {
                containerId: string;
                itemCount: number;
                netWeight: number;
                lashingWeight: number;
                grossWeight: number;
                utilization: number;
            }[];
            totalNetWeight: number;
            totalGrossWeight: number;
            overallUtilization: number;
        }, {
            perContainer: {
                containerId: string;
                itemCount: number;
                netWeight: number;
                lashingWeight: number;
                grossWeight: number;
                utilization: number;
            }[];
            totalNetWeight: number;
            totalGrossWeight: number;
            overallUtilization: number;
        }>;
        warnings: z.ZodArray<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
            severity: z.ZodEnum<["info", "warning", "error"]>;
            relatedItems: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            code: string;
            message: string;
            severity: "info" | "warning" | "error";
            relatedItems?: string[] | undefined;
        }, {
            code: string;
            message: string;
            severity: "info" | "warning" | "error";
            relatedItems?: string[] | undefined;
        }>, "many">;
        solvedAt: z.ZodString;
        solveTimeMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        success: boolean;
        placements: {
            containerId: string;
            position: [number, number, number];
            rotation: [number, number, number];
            cargoIndex: number;
            instanceIndex: number;
        }[];
        unplacedItems: {
            cargoIndex: number;
            reason: string;
        }[];
        lashingPlan: {
            containerId: string;
            straps: {
                type: "strapping" | "tieDown";
                presetCode: string;
                fromPoint: [number, number, number];
                toPoint: [number, number, number];
                securedItems: string[];
            }[];
        }[];
        statistics: {
            perContainer: {
                containerId: string;
                itemCount: number;
                netWeight: number;
                lashingWeight: number;
                grossWeight: number;
                utilization: number;
            }[];
            totalNetWeight: number;
            totalGrossWeight: number;
            overallUtilization: number;
        };
        warnings: {
            code: string;
            message: string;
            severity: "info" | "warning" | "error";
            relatedItems?: string[] | undefined;
        }[];
        solvedAt: string;
        solveTimeMs: number;
    }, {
        success: boolean;
        placements: {
            containerId: string;
            position: [number, number, number];
            rotation: [number, number, number];
            cargoIndex: number;
            instanceIndex: number;
        }[];
        unplacedItems: {
            cargoIndex: number;
            reason: string;
        }[];
        lashingPlan: {
            containerId: string;
            straps: {
                type: "strapping" | "tieDown";
                presetCode: string;
                fromPoint: [number, number, number];
                toPoint: [number, number, number];
                securedItems: string[];
            }[];
        }[];
        statistics: {
            perContainer: {
                containerId: string;
                itemCount: number;
                netWeight: number;
                lashingWeight: number;
                grossWeight: number;
                utilization: number;
            }[];
            totalNetWeight: number;
            totalGrossWeight: number;
            overallUtilization: number;
        };
        warnings: {
            code: string;
            message: string;
            severity: "info" | "warning" | "error";
            relatedItems?: string[] | undefined;
        }[];
        solvedAt: string;
        solveTimeMs: number;
    }>>;
    /** 创建时间 */
    createdAt: z.ZodString;
    /** 更新时间 */
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    name: string;
    containers: {
        id: string;
        length: number;
        width: number;
        height: number;
        name: string;
        maxPayload: number;
        tareWeight: number;
    }[];
    models: {
        id: string;
        fileName: string;
        sourcePdf: string;
        sourcePage: number;
        filePath: string;
        createdAt: string;
    }[];
    scaleRecords: {
        modelId: string;
        scaleFactors: [number, number, number];
        realDimensions: {
            length: number;
            width: number;
            height: number;
        };
        calibratedBy: string;
        calibratedAt: string;
    }[];
    templates: {
        id: string;
        modelId: string;
        displayName: string;
        dimensions: {
            length: number;
            width: number;
            height: number;
        };
        weight: number;
        quantity: number;
        color: string;
        category?: string | undefined;
        density?: number | undefined;
        material?: string | undefined;
        price?: number | undefined;
    }[];
    updatedAt: string;
    solveResult?: {
        success: boolean;
        placements: {
            containerId: string;
            position: [number, number, number];
            rotation: [number, number, number];
            cargoIndex: number;
            instanceIndex: number;
        }[];
        unplacedItems: {
            cargoIndex: number;
            reason: string;
        }[];
        lashingPlan: {
            containerId: string;
            straps: {
                type: "strapping" | "tieDown";
                presetCode: string;
                fromPoint: [number, number, number];
                toPoint: [number, number, number];
                securedItems: string[];
            }[];
        }[];
        statistics: {
            perContainer: {
                containerId: string;
                itemCount: number;
                netWeight: number;
                lashingWeight: number;
                grossWeight: number;
                utilization: number;
            }[];
            totalNetWeight: number;
            totalGrossWeight: number;
            overallUtilization: number;
        };
        warnings: {
            code: string;
            message: string;
            severity: "info" | "warning" | "error";
            relatedItems?: string[] | undefined;
        }[];
        solvedAt: string;
        solveTimeMs: number;
    } | undefined;
}, {
    id: string;
    createdAt: string;
    name: string;
    containers: {
        id: string;
        length: number;
        width: number;
        height: number;
        name: string;
        maxPayload: number;
        tareWeight?: number | undefined;
    }[];
    models: {
        id: string;
        fileName: string;
        sourcePdf: string;
        sourcePage: number;
        filePath: string;
        createdAt: string;
    }[];
    scaleRecords: {
        modelId: string;
        scaleFactors: [number, number, number];
        realDimensions: {
            length: number;
            width: number;
            height: number;
        };
        calibratedBy: string;
        calibratedAt: string;
    }[];
    templates: {
        id: string;
        modelId: string;
        displayName: string;
        dimensions: {
            length: number;
            width: number;
            height: number;
        };
        weight: number;
        quantity: number;
        color: string;
        category?: string | undefined;
        density?: number | undefined;
        material?: string | undefined;
        price?: number | undefined;
    }[];
    updatedAt: string;
    solveResult?: {
        success: boolean;
        placements: {
            containerId: string;
            position: [number, number, number];
            rotation: [number, number, number];
            cargoIndex: number;
            instanceIndex: number;
        }[];
        unplacedItems: {
            cargoIndex: number;
            reason: string;
        }[];
        lashingPlan: {
            containerId: string;
            straps: {
                type: "strapping" | "tieDown";
                presetCode: string;
                fromPoint: [number, number, number];
                toPoint: [number, number, number];
                securedItems: string[];
            }[];
        }[];
        statistics: {
            perContainer: {
                containerId: string;
                itemCount: number;
                netWeight: number;
                lashingWeight: number;
                grossWeight: number;
                utilization: number;
            }[];
            totalNetWeight: number;
            totalGrossWeight: number;
            overallUtilization: number;
        };
        warnings: {
            code: string;
            message: string;
            severity: "info" | "warning" | "error";
            relatedItems?: string[] | undefined;
        }[];
        solvedAt: string;
        solveTimeMs: number;
    } | undefined;
}>;
export type Project = z.infer<typeof ProjectSchema>;
//# sourceMappingURL=project.d.ts.map