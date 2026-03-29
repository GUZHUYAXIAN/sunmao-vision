/**
 * 扎带相关数据契约
 *
 * LashingPreset       — 扎带预设规格
 * LASHING_PRESETS      — 内置 6 种常用扎带规格（3 打包带 + 3 拉紧器）
 */

import { z } from "zod";

// ============================================================
// LashingPreset（扎带预设规格）
// ============================================================

/** 扎带类别：strapping = 打包带, ratchet = 棘轮拉紧器 */
export const LashingCategoryEnum = z.enum(["strapping", "ratchet"]);
export type LashingCategory = z.infer<typeof LashingCategoryEnum>;

export const LashingPresetSchema = z.object({
  /** 规格代号, 如 "PET-Heavy" */
  code: z.string(),
  /** 显示名称 */
  name: z.string(),
  /** 类别 */
  category: LashingCategoryEnum,
  /** 材质 */
  material: z.string(),
  /** 宽度 (mm) */
  width: z.number().positive(),
  /** 厚度 (mm)，仅打包带有此属性 */
  thickness: z.number().positive().optional(),
  /** 工作载荷 (kg) */
  workingLoad: z.number().positive(),
  /** 破断拉力 (kg) */
  breakingForce: z.number().positive(),
  /** 单位长度/个重量 (g/m or g/pc) */
  selfWeight: z.number().positive(),
});

export type LashingPreset = z.infer<typeof LashingPresetSchema>;

// ============================================================
// 内置扎带规格预设数据
// ============================================================

/**
 * 打包带预设（3 种）
 *
 * PP-Standard  — 聚丙烯，轻型货物
 * PET-Heavy    — 聚酯塑钢，中重型
 * Steel-Band   — 热处理钢带，超重型
 */
const STRAPPING_PRESETS: LashingPreset[] = [
  {
    code: "PP-Standard",
    name: "PP 塑料打包带",
    category: "strapping",
    material: "聚丙烯 (PP)",
    width: 16,
    thickness: 0.6,
    workingLoad: 150,
    breakingForce: 250,
    selfWeight: 5.5,
  },
  {
    code: "PET-Heavy",
    name: "PET 塑钢打包带",
    category: "strapping",
    material: "聚酯 (PET)",
    width: 19,
    thickness: 1.0,
    workingLoad: 450,
    breakingForce: 680,
    selfWeight: 14.2,
  },
  {
    code: "Steel-Band",
    name: "钢带",
    category: "strapping",
    material: "热处理钢",
    width: 19,
    thickness: 0.8,
    workingLoad: 1200,
    breakingForce: 1800,
    selfWeight: 95.0,
  },
];

/**
 * 棘轮拉紧器预设（3 种）
 *
 * Ratchet-25  — 25mm 轻型
 * Ratchet-50  — 50mm 标准（最常用）
 * Ratchet-75  — 75mm 重型
 */
const RATCHET_PRESETS: LashingPreset[] = [
  {
    code: "Ratchet-25",
    name: "25mm 轻型拉紧器",
    category: "ratchet",
    material: "涤纶织带 + 钢棘轮",
    width: 25,
    workingLoad: 500,
    breakingForce: 1500,
    selfWeight: 350,
  },
  {
    code: "Ratchet-50",
    name: "50mm 标准拉紧器",
    category: "ratchet",
    material: "涤纶织带 + 钢棘轮",
    width: 50,
    workingLoad: 2000,
    breakingForce: 6000,
    selfWeight: 850,
  },
  {
    code: "Ratchet-75",
    name: "75mm 重型拉紧器",
    category: "ratchet",
    material: "涤纶织带 + 钢棘轮",
    width: 75,
    workingLoad: 5000,
    breakingForce: 15000,
    selfWeight: 1800,
  },
];

/** 全部 6 种内置扎带规格 */
export const LASHING_PRESETS: readonly LashingPreset[] = [
  ...STRAPPING_PRESETS,
  ...RATCHET_PRESETS,
] as const;

/**
 * 根据代号查找扎带预设
 * @param code 规格代号，如 "PET-Heavy"
 * @returns 对应的 LashingPreset 或 undefined
 */
export function findLashingPreset(code: string): LashingPreset | undefined {
  return LASHING_PRESETS.find((preset) => preset.code === code);
}
