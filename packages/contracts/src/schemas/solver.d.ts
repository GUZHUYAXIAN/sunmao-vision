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
export declare const SolveConstraintsSchema: z.ZodObject<{
    /** 是否允许旋转货物 */
    allowRotation: z.ZodDefault<z.ZodBoolean>;
    /** 是否检测重心稳定性 */
    gravityCheck: z.ZodDefault<z.ZodBoolean>;
    /** 最大堆叠层数（不限则不填） */
    maxStackLayers: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    allowRotation: boolean;
    gravityCheck: boolean;
    maxStackLayers?: number | undefined;
}, {
    allowRotation?: boolean | undefined;
    gravityCheck?: boolean | undefined;
    maxStackLayers?: number | undefined;
}>;
export type SolveConstraints = z.infer<typeof SolveConstraintsSchema>;
export declare const LashingConfigSchema: z.ZodObject<{
    /** 选择的打包带规格 */
    strapping: z.ZodObject<{
        code: z.ZodString;
        name: z.ZodString;
        category: z.ZodEnum<["strapping", "ratchet"]>;
        material: z.ZodString;
        width: z.ZodNumber;
        thickness: z.ZodOptional<z.ZodNumber>;
        workingLoad: z.ZodNumber;
        breakingForce: z.ZodNumber;
        selfWeight: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        code: string;
        width: number;
        category: "strapping" | "ratchet";
        material: string;
        name: string;
        workingLoad: number;
        breakingForce: number;
        selfWeight: number;
        thickness?: number | undefined;
    }, {
        code: string;
        width: number;
        category: "strapping" | "ratchet";
        material: string;
        name: string;
        workingLoad: number;
        breakingForce: number;
        selfWeight: number;
        thickness?: number | undefined;
    }>;
    /** 选择的拉紧器规格 */
    tieDown: z.ZodObject<{
        code: z.ZodString;
        name: z.ZodString;
        category: z.ZodEnum<["strapping", "ratchet"]>;
        material: z.ZodString;
        width: z.ZodNumber;
        thickness: z.ZodOptional<z.ZodNumber>;
        workingLoad: z.ZodNumber;
        breakingForce: z.ZodNumber;
        selfWeight: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        code: string;
        width: number;
        category: "strapping" | "ratchet";
        material: string;
        name: string;
        workingLoad: number;
        breakingForce: number;
        selfWeight: number;
        thickness?: number | undefined;
    }, {
        code: string;
        width: number;
        category: "strapping" | "ratchet";
        material: string;
        name: string;
        workingLoad: number;
        breakingForce: number;
        selfWeight: number;
        thickness?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    strapping: {
        code: string;
        width: number;
        category: "strapping" | "ratchet";
        material: string;
        name: string;
        workingLoad: number;
        breakingForce: number;
        selfWeight: number;
        thickness?: number | undefined;
    };
    tieDown: {
        code: string;
        width: number;
        category: "strapping" | "ratchet";
        material: string;
        name: string;
        workingLoad: number;
        breakingForce: number;
        selfWeight: number;
        thickness?: number | undefined;
    };
}, {
    strapping: {
        code: string;
        width: number;
        category: "strapping" | "ratchet";
        material: string;
        name: string;
        workingLoad: number;
        breakingForce: number;
        selfWeight: number;
        thickness?: number | undefined;
    };
    tieDown: {
        code: string;
        width: number;
        category: "strapping" | "ratchet";
        material: string;
        name: string;
        workingLoad: number;
        breakingForce: number;
        selfWeight: number;
        thickness?: number | undefined;
    };
}>;
export type LashingConfig = z.infer<typeof LashingConfigSchema>;
export declare const SolveRequestSchema: z.ZodObject<{
    /** 至少一个集装箱 */
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
    /** 至少一种货物 */
    cargoList: z.ZodArray<z.ZodObject<{
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
    /** 扎带配置 */
    lashing: z.ZodObject<{
        /** 选择的打包带规格 */
        strapping: z.ZodObject<{
            code: z.ZodString;
            name: z.ZodString;
            category: z.ZodEnum<["strapping", "ratchet"]>;
            material: z.ZodString;
            width: z.ZodNumber;
            thickness: z.ZodOptional<z.ZodNumber>;
            workingLoad: z.ZodNumber;
            breakingForce: z.ZodNumber;
            selfWeight: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            code: string;
            width: number;
            category: "strapping" | "ratchet";
            material: string;
            name: string;
            workingLoad: number;
            breakingForce: number;
            selfWeight: number;
            thickness?: number | undefined;
        }, {
            code: string;
            width: number;
            category: "strapping" | "ratchet";
            material: string;
            name: string;
            workingLoad: number;
            breakingForce: number;
            selfWeight: number;
            thickness?: number | undefined;
        }>;
        /** 选择的拉紧器规格 */
        tieDown: z.ZodObject<{
            code: z.ZodString;
            name: z.ZodString;
            category: z.ZodEnum<["strapping", "ratchet"]>;
            material: z.ZodString;
            width: z.ZodNumber;
            thickness: z.ZodOptional<z.ZodNumber>;
            workingLoad: z.ZodNumber;
            breakingForce: z.ZodNumber;
            selfWeight: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            code: string;
            width: number;
            category: "strapping" | "ratchet";
            material: string;
            name: string;
            workingLoad: number;
            breakingForce: number;
            selfWeight: number;
            thickness?: number | undefined;
        }, {
            code: string;
            width: number;
            category: "strapping" | "ratchet";
            material: string;
            name: string;
            workingLoad: number;
            breakingForce: number;
            selfWeight: number;
            thickness?: number | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        strapping: {
            code: string;
            width: number;
            category: "strapping" | "ratchet";
            material: string;
            name: string;
            workingLoad: number;
            breakingForce: number;
            selfWeight: number;
            thickness?: number | undefined;
        };
        tieDown: {
            code: string;
            width: number;
            category: "strapping" | "ratchet";
            material: string;
            name: string;
            workingLoad: number;
            breakingForce: number;
            selfWeight: number;
            thickness?: number | undefined;
        };
    }, {
        strapping: {
            code: string;
            width: number;
            category: "strapping" | "ratchet";
            material: string;
            name: string;
            workingLoad: number;
            breakingForce: number;
            selfWeight: number;
            thickness?: number | undefined;
        };
        tieDown: {
            code: string;
            width: number;
            category: "strapping" | "ratchet";
            material: string;
            name: string;
            workingLoad: number;
            breakingForce: number;
            selfWeight: number;
            thickness?: number | undefined;
        };
    }>;
    /** 求解约束条件 */
    constraints: z.ZodObject<{
        /** 是否允许旋转货物 */
        allowRotation: z.ZodDefault<z.ZodBoolean>;
        /** 是否检测重心稳定性 */
        gravityCheck: z.ZodDefault<z.ZodBoolean>;
        /** 最大堆叠层数（不限则不填） */
        maxStackLayers: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        allowRotation: boolean;
        gravityCheck: boolean;
        maxStackLayers?: number | undefined;
    }, {
        allowRotation?: boolean | undefined;
        gravityCheck?: boolean | undefined;
        maxStackLayers?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    containers: {
        id: string;
        length: number;
        width: number;
        height: number;
        name: string;
        maxPayload: number;
        tareWeight: number;
    }[];
    cargoList: {
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
    lashing: {
        strapping: {
            code: string;
            width: number;
            category: "strapping" | "ratchet";
            material: string;
            name: string;
            workingLoad: number;
            breakingForce: number;
            selfWeight: number;
            thickness?: number | undefined;
        };
        tieDown: {
            code: string;
            width: number;
            category: "strapping" | "ratchet";
            material: string;
            name: string;
            workingLoad: number;
            breakingForce: number;
            selfWeight: number;
            thickness?: number | undefined;
        };
    };
    constraints: {
        allowRotation: boolean;
        gravityCheck: boolean;
        maxStackLayers?: number | undefined;
    };
}, {
    containers: {
        id: string;
        length: number;
        width: number;
        height: number;
        name: string;
        maxPayload: number;
        tareWeight?: number | undefined;
    }[];
    cargoList: {
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
    lashing: {
        strapping: {
            code: string;
            width: number;
            category: "strapping" | "ratchet";
            material: string;
            name: string;
            workingLoad: number;
            breakingForce: number;
            selfWeight: number;
            thickness?: number | undefined;
        };
        tieDown: {
            code: string;
            width: number;
            category: "strapping" | "ratchet";
            material: string;
            name: string;
            workingLoad: number;
            breakingForce: number;
            selfWeight: number;
            thickness?: number | undefined;
        };
    };
    constraints: {
        allowRotation?: boolean | undefined;
        gravityCheck?: boolean | undefined;
        maxStackLayers?: number | undefined;
    };
}>;
export type SolveRequest = z.infer<typeof SolveRequestSchema>;
export declare const PlacementSchema: z.ZodObject<{
    /** 对应 cargoList 中的序号 */
    cargoIndex: z.ZodNumber;
    /** 该种货物的第几个实例 */
    instanceIndex: z.ZodNumber;
    /** 放入的集装箱 ID */
    containerId: z.ZodString;
    /** [x, y, z] 坐标 (mm)，AABB 最小角 */
    position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    /** [rx, ry, rz] 旋转角度 (度) */
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
}>;
export type Placement = z.infer<typeof PlacementSchema>;
export declare const LashingStrapSchema: z.ZodObject<{
    /** 扎带类型 */
    type: z.ZodEnum<["strapping", "tieDown"]>;
    /** 使用的规格代号 */
    presetCode: z.ZodString;
    /** 扎带起点坐标 [x,y,z] (mm) */
    fromPoint: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    /** 扎带终点坐标 [x,y,z] (mm) */
    toPoint: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    /** 被固定的货物实例 ID 列表 */
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
}>;
export type LashingStrap = z.infer<typeof LashingStrapSchema>;
export declare const ContainerLashingPlanSchema: z.ZodObject<{
    /** 集装箱 ID */
    containerId: z.ZodString;
    /** 该集装箱内的所有扎带 */
    straps: z.ZodArray<z.ZodObject<{
        /** 扎带类型 */
        type: z.ZodEnum<["strapping", "tieDown"]>;
        /** 使用的规格代号 */
        presetCode: z.ZodString;
        /** 扎带起点坐标 [x,y,z] (mm) */
        fromPoint: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        /** 扎带终点坐标 [x,y,z] (mm) */
        toPoint: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        /** 被固定的货物实例 ID 列表 */
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
}>;
export type ContainerLashingPlan = z.infer<typeof ContainerLashingPlanSchema>;
export declare const ContainerStatsSchema: z.ZodObject<{
    /** 集装箱 ID */
    containerId: z.ZodString;
    /** 装入货物数量 */
    itemCount: z.ZodNumber;
    /** 净重 = 纯货物重量 (kg) */
    netWeight: z.ZodNumber;
    /** 扎带总重 (kg) */
    lashingWeight: z.ZodNumber;
    /** 毛重 = 货物 + 扎带 + 集装箱皮重 (kg) */
    grossWeight: z.ZodNumber;
    /** 体积利用率 (0-100%) */
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
}>;
export type ContainerStats = z.infer<typeof ContainerStatsSchema>;
export declare const WarningSchema: z.ZodObject<{
    /** 警告代码 */
    code: z.ZodString;
    /** 警告消息 */
    message: z.ZodString;
    /** 严重程度 */
    severity: z.ZodEnum<["info", "warning", "error"]>;
    /** 相关货物 ID 列表 */
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
}>;
export type Warning = z.infer<typeof WarningSchema>;
export declare const SolveResultSchema: z.ZodObject<{
    /** 求解是否成功 */
    success: z.ZodBoolean;
    /** 放置结果列表 */
    placements: z.ZodArray<z.ZodObject<{
        /** 对应 cargoList 中的序号 */
        cargoIndex: z.ZodNumber;
        /** 该种货物的第几个实例 */
        instanceIndex: z.ZodNumber;
        /** 放入的集装箱 ID */
        containerId: z.ZodString;
        /** [x, y, z] 坐标 (mm)，AABB 最小角 */
        position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        /** [rx, ry, rz] 旋转角度 (度) */
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
    /** 未能放置的货物列表 */
    unplacedItems: z.ZodArray<z.ZodObject<{
        /** 对应 cargoList 中的序号 */
        cargoIndex: z.ZodNumber;
        /** 未放置原因 */
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        cargoIndex: number;
        reason: string;
    }, {
        cargoIndex: number;
        reason: string;
    }>, "many">;
    /** 扎带固定方案 */
    lashingPlan: z.ZodArray<z.ZodObject<{
        /** 集装箱 ID */
        containerId: z.ZodString;
        /** 该集装箱内的所有扎带 */
        straps: z.ZodArray<z.ZodObject<{
            /** 扎带类型 */
            type: z.ZodEnum<["strapping", "tieDown"]>;
            /** 使用的规格代号 */
            presetCode: z.ZodString;
            /** 扎带起点坐标 [x,y,z] (mm) */
            fromPoint: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
            /** 扎带终点坐标 [x,y,z] (mm) */
            toPoint: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
            /** 被固定的货物实例 ID 列表 */
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
    /** 统计数据 */
    statistics: z.ZodObject<{
        /** 每个集装箱的统计 */
        perContainer: z.ZodArray<z.ZodObject<{
            /** 集装箱 ID */
            containerId: z.ZodString;
            /** 装入货物数量 */
            itemCount: z.ZodNumber;
            /** 净重 = 纯货物重量 (kg) */
            netWeight: z.ZodNumber;
            /** 扎带总重 (kg) */
            lashingWeight: z.ZodNumber;
            /** 毛重 = 货物 + 扎带 + 集装箱皮重 (kg) */
            grossWeight: z.ZodNumber;
            /** 体积利用率 (0-100%) */
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
        /** 全部集装箱的总净重 (kg) */
        totalNetWeight: z.ZodNumber;
        /** 全部集装箱的总毛重 (kg) */
        totalGrossWeight: z.ZodNumber;
        /** 总体积利用率 (0-100%) */
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
    /** 警告列表 */
    warnings: z.ZodArray<z.ZodObject<{
        /** 警告代码 */
        code: z.ZodString;
        /** 警告消息 */
        message: z.ZodString;
        /** 严重程度 */
        severity: z.ZodEnum<["info", "warning", "error"]>;
        /** 相关货物 ID 列表 */
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
    /** 求解完成时间 */
    solvedAt: z.ZodString;
    /** 求解耗时 (毫秒) */
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
}>;
export type SolveResult = z.infer<typeof SolveResultSchema>;
//# sourceMappingURL=solver.d.ts.map