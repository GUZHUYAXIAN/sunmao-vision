/**
 * @sunmao/solver — 堆叠求解引擎入口
 *
 * 本包是纯计算引擎，零 UI 依赖。
 * 输入 SolveRequest，输出 SolveResult。
 *
 * 公开 API：
 *   - `solve`     — 核心求解函数（调用方负责输入 Zod 验证）
 *   - `safeSolve` — 带双重 Zod 验证的安全入口（推荐 API 层使用）
 *
 * 算法模块（供测试和复用）：
 *   - geometry        — AABB、碰撞检测、旋转变体
 *   - sorting         — 货物排序策略
 *   - placement-engine — Guillotine 放置算法
 *   - weight-checker  — 重量/重心校验
 *   - statistics      — 装载统计计算
 */

export { solve, safeSolve } from "./solve";

// 算法子模块（供单元测试和上层按需导入）
export type { EngineConfig, ContainerPackResult, ItemPlacementResult } from "./placement-engine";
export { packIntoContainer } from "./placement-engine";

export type {
  Vec3,
  Aabb,
  FreeSlot,
  RotationVariant,
} from "./geometry";
export {
  makeAabb,
  aabbFromSlot,
  aabbVolume,
  aabbIntersects,
  isWithinContainer,
  hasAnyIntersection,
  getRotationVariants,
  filterMinimalSlots,
  deduplicateSlots,
} from "./geometry";

export { sortCargoByVolumeAndWeight, computeCargoVolume } from "./sorting";

export {
  checkPayloadCompliance,
  computeCenterOfGravity,
  checkGravityStability,
} from "./weight-checker";

export {
  estimateLashingWeight,
  computeContainerStats,
  computeGlobalStats,
} from "./statistics";
