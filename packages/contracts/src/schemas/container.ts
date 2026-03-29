/**
 * 集装箱数据契约
 *
 * Container — 用户可手动添加多个集装箱，尺寸和载重独立配置
 */

import { z } from "zod";

// ============================================================
// Container（集装箱）
// ============================================================

export const ContainerSchema = z.object({
  /** 唯一标识 */
  id: z.string().uuid(),
  /** 名称，如 "20尺标准柜" */
  name: z.string().min(1),
  /** 内部长度 (mm) */
  length: z.number().positive(),
  /** 内部宽度 (mm) */
  width: z.number().positive(),
  /** 内部高度 (mm) */
  height: z.number().positive(),
  /** 最大载货重量 (kg) */
  maxPayload: z.number().positive(),
  /**
   * 集装箱自身重量 / 皮重 (kg)
   *
   * 用户不输入时默认为 0。
   * 当皮重为 0 时：毛重 = 净重。
   */
  tareWeight: z.number().nonnegative().default(0),
});

export type Container = z.infer<typeof ContainerSchema>;
