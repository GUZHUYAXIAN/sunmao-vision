/**
 * @sunmao/contracts — 统一数据契约
 *
 * 本包是系统的"共同语言"，所有模块必须遵守这里定义的数据格式。
 *
 * 使用方式：
 *   import { CargoTemplateSchema, type CargoTemplate } from "@sunmao/contracts";
 */

// ============================================================
// Schemas（Zod 运行时校验器）
// ============================================================

export {
  ModelAssetSchema,
  ScaleRecordSchema,
} from "./schemas/model";

export {
  CargoTemplateSchema,
  CargoInstanceSchema,
  CargoLocationEnum,
} from "./schemas/cargo";

export { ContainerSchema } from "./schemas/container";

export {
  LashingCategoryEnum,
  LashingPresetSchema,
  LASHING_PRESETS,
  findLashingPreset,
} from "./schemas/lashing";

export {
  SolveConstraintsSchema,
  LashingConfigSchema,
  SolveRequestSchema,
  PlacementSchema,
  LashingStrapSchema,
  ContainerLashingPlanSchema,
  ContainerStatsSchema,
  WarningSchema,
  SolveResultSchema,
} from "./schemas/solver";

export {
  ManifestItemSchema,
  ContainerManifestSchema,
  ExportManifestSchema,
} from "./schemas/export";

export { ProjectSchema } from "./schemas/project";

// ============================================================
// Types（TypeScript 静态类型）
// ============================================================

export type { ModelAsset, ScaleRecord } from "./schemas/model";

export type {
  CargoTemplate,
  CargoInstance,
  CargoLocation,
} from "./schemas/cargo";

export type { Container } from "./schemas/container";

export type {
  LashingCategory,
  LashingPreset,
} from "./schemas/lashing";

export type {
  SolveConstraints,
  LashingConfig,
  SolveRequest,
  Placement,
  LashingStrap,
  ContainerLashingPlan,
  ContainerStats,
  Warning,
  SolveResult,
} from "./schemas/solver";

export type {
  ManifestItem,
  ContainerManifest,
  ExportManifest,
} from "./schemas/export";

export type { Project } from "./schemas/project";
