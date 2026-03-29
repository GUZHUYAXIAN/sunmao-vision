/**
 * 模型相关数据契约
 *
 * ModelAsset  — 从 PDF 生成的原始 OBJ 文件的登记记录
 * ScaleRecord — 模型经过尺寸标定后的校准数据
 */

import { z } from "zod";

// ============================================================
// ModelAsset（模型资产）
// ============================================================

export const ModelAssetSchema = z.object({
  /** 唯一标识 */
  id: z.string().uuid(),
  /** OBJ 文件名，如 "发动机壳体.obj" */
  fileName: z.string().min(1),
  /** 来源 PDF 名称 */
  sourcePdf: z.string().min(1),
  /** 来自 PDF 第几页 */
  sourcePage: z.number().int().min(1),
  /** 本地存储路径 */
  filePath: z.string().min(1),
  /** 创建时间 */
  createdAt: z.string().datetime(),
});

export type ModelAsset = z.infer<typeof ModelAssetSchema>;

// ============================================================
// ScaleRecord（缩放因子记录）
// ============================================================

export const ScaleRecordSchema = z.object({
  /** 对应的 ModelAsset ID */
  modelId: z.string().uuid(),
  /** [X, Y, Z] 轴缩放因子 */
  scaleFactors: z.tuple([
    z.number().positive(),
    z.number().positive(),
    z.number().positive(),
  ]),
  /** 标定后的真实尺寸 (mm) */
  realDimensions: z.object({
    /** 长度 (mm) */
    length: z.number().positive(),
    /** 宽度 (mm) */
    width: z.number().positive(),
    /** 高度 (mm) */
    height: z.number().positive(),
  }),
  /** 标定操作人 */
  calibratedBy: z.string().min(1),
  /** 标定时间 */
  calibratedAt: z.string().datetime(),
});

export type ScaleRecord = z.infer<typeof ScaleRecordSchema>;
