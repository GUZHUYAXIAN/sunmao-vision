/**
 * lashing.ts — 扎带固定方案生成器（HW-002 基础实现 + 物理约束）
 *
 * 纯函数：根据放置结果生成符合 LashingStrap / ContainerLashingPlan 契约的
 * 扎带固定路径。确定性输出：相同输入始终返回相同方案。
 *
 * 算法模型（简化但物理可解释）：
 *
 *   1. 顶层暴露检测
 *      仅对"顶部无其他货物压放"的暴露货物打带——被压在下面的货物
 *      物理上无法单独捆扎。
 *
 *   2. 打包带（strapping）：每件暴露货物最多 2 道围带，支持双向
 *      竖向围带绕货物本体：fromPoint = 环绕平面与顶面交点，
 *      toPoint = 同一竖直平面上的货物底面交点。
 *        - Z 向围带（垂直于长度）：固定 X，环绕 Y-Z 截面，下落段
 *          沿 ±Z 侧面；候选位置从长度方向 25% / 75% 开始。
 *        - X 向围带（垂直于宽度）：固定 Z，环绕 X-Y 截面，下落段
 *          沿 ±X 侧面；当 Z 向全部被阻挡时启用。
 *      候选位置被阻挡时按候选序列回退。
 *
 *   3. 物理约束：扎带不得穿过其他货物
 *      围带下落段需要沿对应侧面留出 STRAP_CLEARANCE_MM 的净空；
 *      若该净空带被相邻货物占用（Y 范围与货物本体重叠），该候选
 *      位置判定为阻挡，放弃此位置的围带。
 *
 *   4. 拉紧器（tieDown）：每 TIE_DOWN_GROUP_SIZE 件暴露货物 1 道
 *      横贯箱宽的横向拉紧带，高度取该 X 列上所有货物的最高点
 *      （保证不穿过任何货物），securedItems 为整组货物。
 *
 * 与 statistics.estimateLashingWeight 的关系：后者是重量"估算"
 * （不区分暴露/被压），本模块是路径"规划"（精确到根）。导出清单
 * 的扎带用量以本模块的规划结果为准。
 */

import type {
  CargoTemplate,
  ContainerLashingPlan,
  LashingConfig,
  LashingStrap,
  Placement,
} from "@sunmao/contracts";
import { GEOMETRY_EPSILON_MM, type Aabb } from "./geometry";

/** 围带下落段沿货物侧面的净空（mm），近似扎带宽度 + 张紧余量 */
const STRAP_CLEARANCE_MM = 20;

/** 每道横向拉紧器固定多少件暴露货物（与 statistics 估算模型保持一致） */
const TIE_DOWN_GROUP_SIZE = 5;

/** 围带候选位置（货物 X 跨度的比例），前两个为首选，其余为阻挡回退 */
const STRAP_POSITION_FRACTIONS = [0.25, 0.75, 0.35, 0.65, 0.5, 0.15, 0.85, 0.1, 0.9] as const;

/** 每件货物需要的围带数量 */
const STRAPS_PER_ITEM = 2;

// ─────────────────────────────────────────────
// 内部辅助
// ─────────────────────────────────────────────

/** XZ 平面上，区间 [aMin, aMax] 与 [bMin, bMax] 是否严格重叠（面贴面不算） */
function strictRangeOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin < bMax - GEOMETRY_EPSILON_MM && bMin < aMax - GEOMETRY_EPSILON_MM;
}

/**
 * 判断第 itemIdx 件货物是否为"顶层暴露"：
 * 不存在其他货物压在其顶面上（XZ 足迹重叠且 minY 贴合 item.maxY）。
 */
function isExposedTopItem(itemIdx: number, aabbs: ReadonlyArray<Aabb>): boolean {
  const item = aabbs[itemIdx];

  for (let otherIdx = 0; otherIdx < aabbs.length; otherIdx++) {
    if (otherIdx === itemIdx) continue;
    const other = aabbs[otherIdx];

    const restsOnTop =
      strictRangeOverlap(item.minX, item.maxX, other.minX, other.maxX) &&
      strictRangeOverlap(item.minZ, item.maxZ, other.minZ, other.maxZ) &&
      other.minY >= item.maxY - GEOMETRY_EPSILON_MM;

    if (restsOnTop) return false;
  }

  return true;
}

/**
 * 围带环绕方向。
 *
 *   - "acrossWidth"  : 固定 X 的竖直平面，环绕 Y-Z 截面，下落段沿 ±Z 侧面
 *   - "acrossLength" : 固定 Z 的竖直平面，环绕 X-Y 截面，下落段沿 ±X 侧面
 */
type StrapOrientation = "acrossWidth" | "acrossLength";

/** 围带候选：环绕平面的固定坐标（Z 向围带用 x，X 向围带用 z，箱体坐标系 mm） */
interface StrapCandidate {
  orientation: StrapOrientation;
  planeCoord: number;
}

/**
 * 围带候选位置是否被相邻货物阻挡（轴对称实现）。
 *
 * 围带下落段沿被环绕货物垂直于平面的两个侧面外扩 STRAP_CLEARANCE_MM。
 * 若任何其他货物的 XZ 足迹侵入该净空带、且 Y 范围与货物本体
 * （minY..maxY）重叠，则判定阻挡。
 *
 * 注：支撑货物（maxY ≈ item.minY）与被压货物（minY ≥ item.maxY）
 * 的 Y 重叠判定天然排除，不会误伤。
 */
function isStrapPositionBlocked(
  candidate: StrapCandidate,
  item: Aabb,
  aabbs: ReadonlyArray<Aabb>,
  itemIdx: number,
): boolean {
  // 被环绕货物沿下落轴的侧面范围（外扩净空）
  const clearMin = candidate.orientation === "acrossWidth"
    ? item.minZ - STRAP_CLEARANCE_MM
    : item.minX - STRAP_CLEARANCE_MM;
  const clearMax = candidate.orientation === "acrossWidth"
    ? item.maxZ + STRAP_CLEARANCE_MM
    : item.maxX + STRAP_CLEARANCE_MM;

  for (let otherIdx = 0; otherIdx < aabbs.length; otherIdx++) {
    if (otherIdx === itemIdx) continue;
    const other = aabbs[otherIdx];

    // 平面轴向：围带平面严格穿过其他货物足迹（面贴面不算穿过）
    const otherPlaneMin = candidate.orientation === "acrossWidth" ? other.minX : other.minZ;
    const otherPlaneMax = candidate.orientation === "acrossWidth" ? other.maxX : other.maxZ;
    const passesThroughPlane = otherPlaneMin < candidate.planeCoord - GEOMETRY_EPSILON_MM &&
      otherPlaneMax > candidate.planeCoord + GEOMETRY_EPSILON_MM;
    if (!passesThroughPlane) continue;

    // 下落轴：其他货物侵入围带下落净空带
    const otherClearMin = candidate.orientation === "acrossWidth" ? other.minZ : other.minX;
    const otherClearMax = candidate.orientation === "acrossWidth" ? other.maxZ : other.maxX;
    if (!strictRangeOverlap(clearMin, clearMax, otherClearMin, otherClearMax)) continue;

    // Y 方向：其他货物与货物本体在高度上共存（支撑/被压关系排除）
    const coexistsInY = other.minY < item.maxY - GEOMETRY_EPSILON_MM &&
      other.maxY > item.minY + GEOMETRY_EPSILON_MM;
    if (!coexistsInY) continue;

    return true;
  }

  return false;
}

/**
 * 生成某件暴露货物的围带候选序列：优先 Z 向（垂直于长度），
 * 后备 X 向（垂直于宽度）；每个方向内按 STRAP_POSITION_FRACTIONS 排布。
 */
function buildStrapCandidates(item: Aabb): StrapCandidate[] {
  const candidates: StrapCandidate[] = [];

  for (const fraction of STRAP_POSITION_FRACTIONS) {
    candidates.push({
      orientation: "acrossWidth",
      planeCoord: item.minX + (item.maxX - item.minX) * fraction,
    });
  }
  for (const fraction of STRAP_POSITION_FRACTIONS) {
    candidates.push({
      orientation: "acrossLength",
      planeCoord: item.minZ + (item.maxZ - item.minZ) * fraction,
    });
  }

  return candidates;
}

// ─────────────────────────────────────────────
// 主生成函数
// ─────────────────────────────────────────────

export interface LashingPlanResult {
  /** 该集装箱的扎带方案（符合 ContainerLashingPlan 契约） */
  plan: ContainerLashingPlan;
  /**
   * 因阻挡而无法打满围带的暴露货物数量。
   * 调用方（solve）可据此产生 warning 提示用户人工加固。
   */
  underSecuredItemCount: number;
}

/**
 * 为单个集装箱生成扎带固定方案。
 *
 * @param containerId    - 集装箱 ID（UUID）
 * @param containerWidth - 集装箱内宽（mm），用于拉紧带横贯方向
 * @param placements     - 本箱内成功放置的货物（与 aabbs 顺序一致）
 * @param aabbs          - 本箱内货物的世界/箱体坐标系 AABB
 * @param templateMap    - cargoIndex → CargoTemplate（securedItems 需要模板 UUID）
 * @param lashingConfig  - 扎带规格配置
 */
export function generateContainerLashingPlan(
  containerId: string,
  containerWidth: number,
  placements: ReadonlyArray<Placement>,
  aabbs: ReadonlyArray<Aabb>,
  templateMap: ReadonlyMap<number, CargoTemplate>,
  lashingConfig: LashingConfig,
): LashingPlanResult {
  const straps: LashingStrap[] = [];
  let underSecuredItemCount = 0;

  // Step 1: 找出全部顶层暴露货物
  const exposedIndices: number[] = [];
  for (let idx = 0; idx < aabbs.length; idx++) {
    if (isExposedTopItem(idx, aabbs)) {
      exposedIndices.push(idx);
    }
  }

  // Step 2: 每件暴露货物尝试打 STRAPS_PER_ITEM 道围带（双向候选）
  for (const itemIdx of exposedIndices) {
    const item = aabbs[itemIdx];
    const placement = placements[itemIdx];
    const template = templateMap.get(placement.cargoIndex);
    if (template === undefined) continue;

    const xCenter = (item.minX + item.maxX) / 2;
    const zCenter = (item.minZ + item.maxZ) / 2;
    let strapCount = 0;

    for (const candidate of buildStrapCandidates(item)) {
      if (strapCount >= STRAPS_PER_ITEM) break;
      if (isStrapPositionBlocked(candidate, item, aabbs, itemIdx)) continue;

      const [fromX, fromZ, toX, toZ] =
        candidate.orientation === "acrossWidth"
          ? [candidate.planeCoord, zCenter, candidate.planeCoord, zCenter]
          : [xCenter, candidate.planeCoord, xCenter, candidate.planeCoord];

      straps.push({
        type: "strapping",
        presetCode: lashingConfig.strapping.code,
        fromPoint: [fromX, item.maxY, fromZ],
        toPoint: [toX, item.minY, toZ],
        securedItems: [template.id],
      });
      strapCount += 1;
    }

    if (strapCount < STRAPS_PER_ITEM) {
      underSecuredItemCount += 1;
    }
  }

  // Step 3: 暴露货物按 X 中心排序，每 TIE_DOWN_GROUP_SIZE 件一组拉拉紧器
  const exposedSorted = [...exposedIndices].sort((aIdx, bIdx) => {
    const aCenter = (aabbs[aIdx].minX + aabbs[aIdx].maxX) / 2;
    const bCenter = (aabbs[bIdx].minX + aabbs[bIdx].maxX) / 2;
    return aCenter - bCenter;
  });

  for (let groupStart = 0; groupStart < exposedSorted.length; groupStart += TIE_DOWN_GROUP_SIZE) {
    const group = exposedSorted.slice(groupStart, groupStart + TIE_DOWN_GROUP_SIZE);
    if (group.length === 0) break;

    const groupCenterX =
      group.reduce((sum, idx) => sum + (aabbs[idx].minX + aabbs[idx].maxX) / 2, 0) /
      group.length;

    // 拉紧带高度 = 该 X 列上所有货物的最高点，保证横贯线不穿箱
    let tieDownY = 0;
    for (const other of aabbs) {
      const spansX = other.minX < groupCenterX && other.maxX > groupCenterX;
      if (spansX) {
        tieDownY = Math.max(tieDownY, other.maxY);
      }
    }

    const securedTemplateIds = [
      ...new Set(
        group
          .map((idx) => templateMap.get(placements[idx].cargoIndex)?.id)
          .filter((id): id is string => id !== undefined),
      ),
    ];

    straps.push({
      type: "tieDown",
      presetCode: lashingConfig.tieDown.code,
      fromPoint: [groupCenterX, tieDownY, 0],
      toPoint: [groupCenterX, tieDownY, containerWidth],
      securedItems: securedTemplateIds,
    });
  }

  return {
    plan: { containerId, straps },
    underSecuredItemCount,
  };
}
