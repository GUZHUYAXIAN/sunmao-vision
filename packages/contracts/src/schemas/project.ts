/**
 * 项目级别数据契约
 *
 * Project — 包含一个项目的全部信息（类比 FEA .cae 项目文件）
 */

import { z } from "zod";
import { ModelAssetSchema, ScaleRecordSchema } from "./model";
import { CargoTemplateSchema } from "./cargo";
import { ContainerSchema } from "./container";
import { SolveResultSchema } from "./solver";

// ============================================================
// Project（项目）
// ============================================================

export const ProjectSchema = z.object({
  /** 唯一标识 */
  id: z.string().uuid(),
  /** 项目名称 */
  name: z.string().min(1),
  /** 导入的模型列表 */
  models: z.array(ModelAssetSchema),
  /** 缩放标定记录 */
  scaleRecords: z.array(ScaleRecordSchema),
  /** 货物模板列表 */
  templates: z.array(CargoTemplateSchema),
  /** 集装箱列表 */
  containers: z.array(ContainerSchema),
  /** 最新求解结果（可能尚未求解） */
  solveResult: SolveResultSchema.optional(),
  /** 创建时间 */
  createdAt: z.string().datetime(),
  /** 更新时间 */
  updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof ProjectSchema>;
