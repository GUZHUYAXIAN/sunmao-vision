/**
 * 货物相关数据契约
 *
 * CargoTemplate — 一种货物的"产品说明书"（固有属性）
 * CargoInstance — 具体放在某个位置的那一个货物
 */

import { z } from "zod";

// ============================================================
// CargoTemplate（货物模板）
// ============================================================

export const CargoTemplateSchema = z.object({
  /** 唯一标识 */
  id: z.string().uuid(),
  /** 关联的 ModelAsset ID */
  modelId: z.string().uuid(),
  /** 显示名称 */
  displayName: z.string().min(1),
  /** 包围盒尺寸 (mm) */
  dimensions: z.object({
    /** 长 (mm) */
    length: z.number().positive(),
    /** 宽 (mm) */
    width: z.number().positive(),
    /** 高 (mm) */
    height: z.number().positive(),
  }),
  /** 单件重量 (kg) */
  weight: z.number().nonnegative(),
  /** 需要装箱的数量 */
  quantity: z.number().int().min(1),
  /** 3D 场景中的显示颜色 (Hex) */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),

  // --- 扩展属性（可选）---
  /** 类别，如"机械零件" */
  category: z.string().optional(),
  /** 密度 (g/cm³) */
  density: z.number().positive().optional(),
  /** 材质 */
  material: z.string().optional(),
  /** 单价 (¥) */
  price: z.number().nonnegative().optional(),
});

export type CargoTemplate = z.infer<typeof CargoTemplateSchema>;

// ============================================================
// CargoInstance（货物实例）
// ============================================================

/** 货物所处位置：暂存区 or 已入柜 */
export const CargoLocationEnum = z.enum(["staging", "container"]);
export type CargoLocation = z.infer<typeof CargoLocationEnum>;

export const CargoInstanceSchema = z.object({
  /** 唯一标识 */
  id: z.string().uuid(),
  /** 所属 CargoTemplate 的 ID */
  templateId: z.string().uuid(),
  /** 所处位置 */
  location: CargoLocationEnum,
  /** 在哪个集装箱里（仅 location="container" 时有效） */
  containerId: z.string().uuid().optional(),
  /** [x, y, z] 坐标 (mm)，相对于集装箱原点的绝对坐标 */
  position: z.tuple([z.number(), z.number(), z.number()]),
  /** [rx, ry, rz] 旋转角度 (度) */
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  /** 是否被选中（UI 状态） */
  selected: z.boolean().default(false),
});

export type CargoInstance = z.infer<typeof CargoInstanceSchema>;
