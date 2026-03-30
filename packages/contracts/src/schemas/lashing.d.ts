/**
 * 扎带相关数据契约
 *
 * LashingPreset       — 扎带预设规格
 * LASHING_PRESETS      — 内置 6 种常用扎带规格（3 打包带 + 3 拉紧器）
 */
import { z } from "zod";
/** 扎带类别：strapping = 打包带, ratchet = 棘轮拉紧器 */
export declare const LashingCategoryEnum: z.ZodEnum<["strapping", "ratchet"]>;
export type LashingCategory = z.infer<typeof LashingCategoryEnum>;
export declare const LashingPresetSchema: z.ZodObject<{
    /** 规格代号, 如 "PET-Heavy" */
    code: z.ZodString;
    /** 显示名称 */
    name: z.ZodString;
    /** 类别 */
    category: z.ZodEnum<["strapping", "ratchet"]>;
    /** 材质 */
    material: z.ZodString;
    /** 宽度 (mm) */
    width: z.ZodNumber;
    /** 厚度 (mm)，仅打包带有此属性 */
    thickness: z.ZodOptional<z.ZodNumber>;
    /** 工作载荷 (kg) */
    workingLoad: z.ZodNumber;
    /** 破断拉力 (kg) */
    breakingForce: z.ZodNumber;
    /** 单位长度/个重量 (g/m or g/pc) */
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
export type LashingPreset = z.infer<typeof LashingPresetSchema>;
/** 全部 6 种内置扎带规格 */
export declare const LASHING_PRESETS: readonly LashingPreset[];
/**
 * 根据代号查找扎带预设
 * @param code 规格代号，如 "PET-Heavy"
 * @returns 对应的 LashingPreset 或 undefined
 */
export declare function findLashingPreset(code: string): LashingPreset | undefined;
//# sourceMappingURL=lashing.d.ts.map