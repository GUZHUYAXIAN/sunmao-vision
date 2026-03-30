/**
 * sorting.ts — 货物排序策略
 *
 * 实现"先大后重"排序：优先放置体积大的货物，同体积时优先放置重的。
 * 这是 Best-Fit Decreasing (BFD) 箱装算法的标准启发策略。
 * 所有函数均为无副作用纯函数，不修改输入数组。
 */

import type { CargoTemplate } from "@sunmao/contracts";

// ─────────────────────────────────────────────
// 内部类型
// ─────────────────────────────────────────────

/** 携带预计算体积的货物模板（避免排序时重复计算） */
type AnnotatedTemplate = {
  readonly template: CargoTemplate;
  readonly volume: number;
};

// ─────────────────────────────────────────────
// 体积计算
// ─────────────────────────────────────────────

/**
 * 计算货物模板的包围盒体积（mm³）。
 * 使用 dimensions 字段中的 length × width × height。
 */
export function computeCargoVolume(template: CargoTemplate): number {
  const { length, width, height } = template.dimensions;
  return length * width * height;
}

// ─────────────────────────────────────────────
// 排序策略
// ─────────────────────────────────────────────

/**
 * 按"体积降序 → 重量降序"对货物模板列表排序。
 *
 * 排序规则（参考旧版 BoxStack/SmartContainer 行为）：
 *   1. 体积大的优先（柜体利用率最大化）
 *   2. 体积相同时，重量大的优先（重心更低，稳定性更好）
 *   3. 两者均相同时，保持原始相对顺序（稳定排序）
 *
 * @param templates - 原始货物模板列表（不可变，函数内不修改）
 * @returns 排序后的新数组，元素为原始引用
 */
export function sortCargoByVolumeAndWeight(
  templates: readonly CargoTemplate[],
): CargoTemplate[] {
  const annotated: AnnotatedTemplate[] = templates.map((template) => ({
    template,
    volume: computeCargoVolume(template),
  }));

  annotated.sort((itemA, itemB) => {
    const volumeDelta = itemB.volume - itemA.volume;
    if (volumeDelta !== 0) {
      return volumeDelta;
    }
    return itemB.template.weight - itemA.template.weight;
  });

  return annotated.map((annotated) => annotated.template);
}
