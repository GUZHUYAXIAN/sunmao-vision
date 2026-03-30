/**
 * 模型相关数据契约
 *
 * ModelAsset  — 从 PDF 生成的原始 OBJ 文件的登记记录
 * ScaleRecord — 模型经过尺寸标定后的校准数据
 */
import { z } from "zod";
export declare const ModelAssetSchema: z.ZodObject<{
    /** 唯一标识 */
    id: z.ZodString;
    /** OBJ 文件名，如 "发动机壳体.obj" */
    fileName: z.ZodString;
    /** 来源 PDF 名称 */
    sourcePdf: z.ZodString;
    /** 来自 PDF 第几页 */
    sourcePage: z.ZodNumber;
    /** 本地存储路径 */
    filePath: z.ZodString;
    /** 创建时间 */
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
}>;
export type ModelAsset = z.infer<typeof ModelAssetSchema>;
export declare const ScaleRecordSchema: z.ZodObject<{
    /** 对应的 ModelAsset ID */
    modelId: z.ZodString;
    /** [X, Y, Z] 轴缩放因子 */
    scaleFactors: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    /** 标定后的真实尺寸 (mm) */
    realDimensions: z.ZodObject<{
        /** 长度 (mm) */
        length: z.ZodNumber;
        /** 宽度 (mm) */
        width: z.ZodNumber;
        /** 高度 (mm) */
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
    /** 标定操作人 */
    calibratedBy: z.ZodString;
    /** 标定时间 */
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
}>;
export type ScaleRecord = z.infer<typeof ScaleRecordSchema>;
//# sourceMappingURL=model.d.ts.map