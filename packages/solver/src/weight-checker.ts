/**
 * weight-checker.ts — 重量与重心校验
 *
 * 提供两个校验维度：
 *   1. 载重超限检测 —— 是否超出集装箱 maxPayload
 *   2. 重心稳定性评估 —— 重心偏移是否在安全阈值内
 *
 * 所有函数均为无副作用纯函数。
 */

import type { CargoTemplate, Container, Placement, Warning } from "@sunmao/contracts";
import { GEOMETRY_EPSILON_MM, type Aabb } from "./geometry";

// ─────────────────────────────────────────────
// 内部类型
// ─────────────────────────────────────────────

/** 重心计算中间结果 */
type CenterOfGravity = {
  /** 重心在集装箱坐标系中的 X/Y/Z 位置（mm） */
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

/** 单个货物底面支撑校验结果 */
export type BottomSupportCheck = {
  /** 底面总面积（mm²） */
  readonly footprintArea: number;
  /** 被下方支撑面的有效支撑面积（mm²） */
  readonly supportedArea: number;
  /** 底面支撑率（0-1） */
  readonly supportRatio: number;
  /** 是否直接落在地板上 */
  readonly supportedByFloor: boolean;
  /** 货物底面几何中心是否落在支撑投影内 */
  readonly isCenterSupported: boolean;
  /** 实际参与支撑的下层货物数量 */
  readonly supportingItems: number;
};

function computeOverlapLength(
  rangeStartA: number,
  rangeEndA: number,
  rangeStartB: number,
  rangeEndB: number,
): number {
  const overlapLength = Math.min(rangeEndA, rangeEndB) - Math.max(rangeStartA, rangeStartB);
  return overlapLength > GEOMETRY_EPSILON_MM ? overlapLength : 0;
}

function isSupportPlaneAligned(candidateBottomY: number, supportTopY: number): boolean {
  return Math.abs(candidateBottomY - supportTopY) <= GEOMETRY_EPSILON_MM;
}

export function computeBottomSupportCheck(
  box: Aabb,
  occupiedAabbs: readonly Aabb[],
): BottomSupportCheck {
  const footprintArea = (box.maxX - box.minX) * (box.maxZ - box.minZ);

  if (box.minY <= GEOMETRY_EPSILON_MM) {
    return {
      footprintArea,
      supportedArea: footprintArea,
      supportRatio: 1,
      supportedByFloor: true,
      isCenterSupported: true,
      supportingItems: 0,
    };
  }

  const footprintCenterX = (box.minX + box.maxX) / 2;
  const footprintCenterZ = (box.minZ + box.maxZ) / 2;

  let supportedArea = 0;
  let isCenterSupported = false;
  let supportingItems = 0;

  for (const occupiedBox of occupiedAabbs) {
    if (!isSupportPlaneAligned(box.minY, occupiedBox.maxY)) {
      continue;
    }

    const overlapLengthX = computeOverlapLength(
      box.minX,
      box.maxX,
      occupiedBox.minX,
      occupiedBox.maxX,
    );
    const overlapWidthZ = computeOverlapLength(
      box.minZ,
      box.maxZ,
      occupiedBox.minZ,
      occupiedBox.maxZ,
    );

    if (overlapLengthX === 0 || overlapWidthZ === 0) {
      continue;
    }

    supportedArea += overlapLengthX * overlapWidthZ;
    supportingItems += 1;

    if (
      footprintCenterX >= occupiedBox.minX - GEOMETRY_EPSILON_MM &&
      footprintCenterX <= occupiedBox.maxX + GEOMETRY_EPSILON_MM &&
      footprintCenterZ >= occupiedBox.minZ - GEOMETRY_EPSILON_MM &&
      footprintCenterZ <= occupiedBox.maxZ + GEOMETRY_EPSILON_MM
    ) {
      isCenterSupported = true;
    }
  }

  const clampedSupportedArea = Math.min(footprintArea, supportedArea);
  const supportRatio = footprintArea === 0 ? 0 : clampedSupportedArea / footprintArea;

  return {
    footprintArea,
    supportedArea: clampedSupportedArea,
    supportRatio,
    supportedByFloor: false,
    isCenterSupported,
    supportingItems,
  };
}

/**
 * 底面支撑率阈值：货物底面至少需要被下方支撑面覆盖的比例。
 * 物理依据：行业通行标准要求底面重心必须在支撑投影内，且接触面积不低于 70%，
 * 以防止货物在运输振动中倾倒。强制要求 100% 会错误地拒绝桥接式放置。
 */
export const MINIMUM_BOTTOM_SUPPORT_RATIO = 0.7;

export function hasSufficientBottomSupport(
  box: Aabb,
  occupiedAabbs: readonly Aabb[],
  minimumSupportRatio = MINIMUM_BOTTOM_SUPPORT_RATIO,
): boolean {
  const supportCheck = computeBottomSupportCheck(box, occupiedAabbs);
  return (
    supportCheck.supportRatio + GEOMETRY_EPSILON_MM >= minimumSupportRatio &&
    supportCheck.isCenterSupported
  );
}

// ─────────────────────────────────────────────
// 重量合规检测
// ─────────────────────────────────────────────

/**
 * 检测一个集装箱的装载方案是否超出最大载重。
 *
 * 返回警告列表（空列表 = 合规）。
 *
 * @param placedItems   - 已成功放置的货物列表
 * @param templateMap   - cargoIndex → CargoTemplate 的查找表
 * @param container     - 集装箱规格
 */
export function checkPayloadCompliance(
  placedItems: ReadonlyArray<{ cargoIndex: number; instanceIndex: number }>,
  templateMap: ReadonlyMap<number, CargoTemplate>,
  container: Container,
): Warning[] {
  const warnings: Warning[] = [];

  let totalCargoWeight = 0;
  for (const item of placedItems) {
    const template = templateMap.get(item.cargoIndex);
    if (template !== undefined) {
      totalCargoWeight += template.weight;
    }
  }

  if (totalCargoWeight > container.maxPayload) {
    warnings.push({
      code: "PAYLOAD_EXCEEDED",
      message: `集装箱 "${container.name}" 净货重 ${totalCargoWeight.toFixed(1)}kg 超出最大载重 ${container.maxPayload}kg`,
      severity: "error",
    });
  } else if (totalCargoWeight > container.maxPayload * 0.95) {
    warnings.push({
      code: "PAYLOAD_NEAR_LIMIT",
      message: `集装箱 "${container.name}" 净货重 ${totalCargoWeight.toFixed(1)}kg 已接近最大载重的 95%`,
      severity: "warning",
    });
  }

  return warnings;
}

// ─────────────────────────────────────────────
// 重心稳定性分析
// ─────────────────────────────────────────────

/**
 * 计算集装箱内所有已放置货物的综合重心位置。
 *
 * 计算方法：以每件货物的几何中心为其质心，加权平均。
 *
 * @param placements  - 放置结果列表
 * @param aabbs       - 对应 placements 的 AABB 列表（顺序一致）
 * @param templateMap - cargoIndex → CargoTemplate
 */
export function computeCenterOfGravity(
  placements: ReadonlyArray<Placement>,
  aabbs: ReadonlyArray<Aabb>,
  templateMap: ReadonlyMap<number, CargoTemplate>,
): CenterOfGravity | null {
  if (placements.length === 0) return null;

  let totalMomentX = 0;
  let totalMomentY = 0;
  let totalMomentZ = 0;
  let totalWeight = 0;

  for (let itemIndex = 0; itemIndex < placements.length; itemIndex++) {
    const placement = placements[itemIndex];
    const aabb = aabbs[itemIndex];
    const template = templateMap.get(placement.cargoIndex);

    if (template === undefined || aabb === undefined) continue;

    const weight = template.weight;
    // 货物几何中心
    const centerX = (aabb.minX + aabb.maxX) / 2;
    const centerY = (aabb.minY + aabb.maxY) / 2;
    const centerZ = (aabb.minZ + aabb.maxZ) / 2;

    totalMomentX += centerX * weight;
    totalMomentY += centerY * weight;
    totalMomentZ += centerZ * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;

  return {
    x: totalMomentX / totalWeight,
    y: totalMomentY / totalWeight,
    z: totalMomentZ / totalWeight,
  };
}

/**
 * 检测重心是否在容器中心的安全范围内，并生成相应警告。
 *
 * 安全阈值（可配置，但默认值来自行业经验）：
 *   - 横向（Z 方向）偏移不超过集装箱宽度的 15%
 *   - 纵向（X 方向）偏移不超过集装箱长度的 15%
 *
 * 重心过高本身不产生警告（由物理规则保证 Y 的上限）。
 *
 * @param cog         - 重心坐标
 * @param container   - 集装箱规格（提供中心点基准）
 * @param checkEnabled - 是否开启重心校验（对应 SolveConstraints.gravityCheck）
 */
export function checkGravityStability(
  cog: CenterOfGravity,
  container: Container,
  checkEnabled: boolean,
): Warning[] {
  if (!checkEnabled) return [];

  const warnings: Warning[] = [];

  const containerCenterX = container.length / 2;
  const containerCenterZ = container.width / 2;

  const lateralOffset = Math.abs(cog.z - containerCenterZ);
  const longitudinalOffset = Math.abs(cog.x - containerCenterX);

  const LATERAL_THRESHOLD = container.width * 0.15;
  const LONGITUDINAL_THRESHOLD = container.length * 0.15;

  if (lateralOffset > LATERAL_THRESHOLD) {
    warnings.push({
      code: "COG_LATERAL_OFFSET",
      message: `集装箱 "${container.name}" 重心横向偏移 ${lateralOffset.toFixed(0)}mm，超过安全阈值 ${LATERAL_THRESHOLD.toFixed(0)}mm（宽度15%）。建议重新排布两侧货物。`,
      severity: "warning",
    });
  }

  if (longitudinalOffset > LONGITUDINAL_THRESHOLD) {
    warnings.push({
      code: "COG_LONGITUDINAL_OFFSET",
      message: `集装箱 "${container.name}" 重心纵向偏移 ${longitudinalOffset.toFixed(0)}mm，超过安全阈值 ${LONGITUDINAL_THRESHOLD.toFixed(0)}mm（长度15%）。建议调整前后载重分布。`,
      severity: "info",
    });
  }

  return warnings;
}

/**
 * 检测每个已放置货物的底面是否被完整支撑。
 *
 * 这是对“整柜重心”之外的局部稳定性补充：
 *   - 整柜重心正常，并不代表某一件上层货物没有悬空
 *   - 若某件货物底面支撑不足，则直接产生 error 级警告
 */
export function checkBottomSupportStability(
  placements: ReadonlyArray<Placement>,
  aabbs: ReadonlyArray<Aabb>,
  container: Container,
  checkEnabled: boolean,
): Warning[] {
  if (!checkEnabled) return [];

  const warnings: Warning[] = [];

  for (let itemIndex = 0; itemIndex < placements.length; itemIndex++) {
    const placement = placements[itemIndex];
    const aabb = aabbs[itemIndex];

    if (placement === undefined || aabb === undefined) {
      continue;
    }

    const supportCheck = computeBottomSupportCheck(aabb, aabbs);
    if (supportCheck.supportRatio + GEOMETRY_EPSILON_MM >= 1) {
      continue;
    }

    warnings.push({
      code: "BOTTOM_SUPPORT_INSUFFICIENT",
      message: `集装箱 "${container.name}" 中货物 cargoIndex=${placement.cargoIndex} / instanceIndex=${placement.instanceIndex} 的底面支撑率仅为 ${(supportCheck.supportRatio * 100).toFixed(1)}%，存在悬空风险。`,
      severity: "error",
    });
  }

  return warnings;
}
