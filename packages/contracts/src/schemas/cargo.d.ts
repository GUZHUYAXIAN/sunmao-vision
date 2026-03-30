/**
 * 货物相关数据契约
 *
 * CargoTemplate — 一种货物的"产品说明书"（固有属性）
 * CargoInstance — 具体放在某个位置的那一个货物
 */
import { z } from "zod";
export declare const CargoTemplateSchema: z.ZodObject<{
    /** 唯一标识 */
    id: z.ZodString;
    /** 关联的 ModelAsset ID */
    modelId: z.ZodString;
    /** 显示名称 */
    displayName: z.ZodString;
    /** 包围盒尺寸 (mm) */
    dimensions: z.ZodObject<{
        /** 长 (mm) */
        length: z.ZodNumber;
        /** 宽 (mm) */
        width: z.ZodNumber;
        /** 高 (mm) */
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
    /** 单件重量 (kg) */
    weight: z.ZodNumber;
    /** 需要装箱的数量 */
    quantity: z.ZodNumber;
    /** 3D 场景中的显示颜色 (Hex) */
    color: z.ZodString;
    /** 类别，如"机械零件" */
    category: z.ZodOptional<z.ZodString>;
    /** 密度 (g/cm³) */
    density: z.ZodOptional<z.ZodNumber>;
    /** 材质 */
    material: z.ZodOptional<z.ZodString>;
    /** 单价 (¥) */
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
}>;
export type CargoTemplate = z.infer<typeof CargoTemplateSchema>;
/** 货物所处位置：暂存区 or 已入柜 */
export declare const CargoLocationEnum: z.ZodEnum<["staging", "container"]>;
export type CargoLocation = z.infer<typeof CargoLocationEnum>;
export declare const CargoInstanceSchema: z.ZodObject<{
    /** 唯一标识 */
    id: z.ZodString;
    /** 所属 CargoTemplate 的 ID */
    templateId: z.ZodString;
    /** 所处位置 */
    location: z.ZodEnum<["staging", "container"]>;
    /** 在哪个集装箱里（仅 location="container" 时有效） */
    containerId: z.ZodOptional<z.ZodString>;
    /** [x, y, z] 坐标 (mm)，相对于集装箱原点的绝对坐标 */
    position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    /** [rx, ry, rz] 旋转角度 (度) */
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    /** 是否被选中（UI 状态） */
    selected: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    templateId: string;
    location: "staging" | "container";
    position: [number, number, number];
    rotation: [number, number, number];
    selected: boolean;
    containerId?: string | undefined;
}, {
    id: string;
    templateId: string;
    location: "staging" | "container";
    position: [number, number, number];
    containerId?: string | undefined;
    rotation?: [number, number, number] | undefined;
    selected?: boolean | undefined;
}>;
export type CargoInstance = z.infer<typeof CargoInstanceSchema>;
//# sourceMappingURL=cargo.d.ts.map