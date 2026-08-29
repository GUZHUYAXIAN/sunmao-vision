/**
 * lashing.ts — 扎带固定方案生成器单元测试
 *
 * 覆盖：顶层暴露检测、围带数量与位置、物理阻挡回退、
 * 拉紧器分组、无货物边界，以及经 solve() 的端到端集成。
 */
import { describe, expect, it } from "vitest";
import type { CargoTemplate, ContainerLashingPlan, LashingConfig, Placement } from "@sunmao/contracts";
import { makeAabb, solve } from "../src";
import { generateContainerLashingPlan } from "../src/lashing";

/** 取方案中的围带（非拉紧器） */
function strapping(plan: ContainerLashingPlan) {
  return plan.straps.filter((strap) => strap.type === "strapping");
}

// ─── 测试夹具 ────────────────────────────────────────────────

const LASHING_CONFIG: LashingConfig = {
  strapping: {
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
  tieDown: {
    code: "Ratchet-50",
    name: "50mm 标准拉紧器",
    category: "ratchet",
    material: "涤纶织带 + 钢棘轮",
    width: 50,
    workingLoad: 2000,
    breakingForce: 6000,
    selfWeight: 850,
  },
};

function makeTemplate(id: string): CargoTemplate {
  return {
    id,
    modelId: "00000000-0000-4000-8000-000000000000",
    displayName: `货物-${id}`,
    dimensions: { length: 1000, width: 800, height: 600 },
    weight: 100,
    quantity: 1,
    color: "#ff0000",
  };
}

/** 生成一个货物实例的 placement + AABB（AABB 最小角语义，与放置引擎一致） */
function makePlacedItem(
  cargoIndex: number,
  instanceIndex: number,
  x: number,
  y: number,
  z: number,
  dims = { length: 1000, width: 800, height: 600 },
): { placement: Placement; aabb: ReturnType<typeof makeAabb> } {
  const templateId = `00000000-0000-4000-8000-${String(cargoIndex).padStart(12, "0")}`;
  return {
    placement: {
      cargoIndex,
      instanceIndex,
      containerId: "11111111-1111-4111-8111-111111111111",
      position: [x, y, z],
      rotation: [0, 0, 0],
    },
    aabb: makeAabb(x, y, z, dims.length, dims.height, dims.width),
  };
}

function makeTemplateMap(templates: CargoTemplate[]): Map<number, CargoTemplate> {
  return new Map(templates.map((template, index): [number, CargoTemplate] => [index, template]));
}

// ─── 纯函数测试 ──────────────────────────────────────────────

describe("generateContainerLashingPlan", () => {
  const CONTAINER_ID = "11111111-1111-4111-8111-111111111111";

  it("空箱返回空方案", () => {
    const { plan, underSecuredItemCount } = generateContainerLashingPlan(
      CONTAINER_ID,
      2352,
      [],
      [],
      new Map(),
      LASHING_CONFIG,
    );
    expect(plan.containerId).toBe(CONTAINER_ID);
    expect(plan.straps).toHaveLength(0);
    expect(underSecuredItemCount).toBe(0);
  });

  it("单件落地货物：2 道围带 + 1 道拉紧器", () => {
    const item = makePlacedItem(0, 0, 0, 0, 0);
    const templates = [makeTemplate("00000000-0000-4000-8000-000000000000")];

    const { plan, underSecuredItemCount } = generateContainerLashingPlan(
      CONTAINER_ID,
      2352,
      [item.placement],
      [item.aabb],
      makeTemplateMap(templates),
      LASHING_CONFIG,
    );

    const strapping = plan.straps.filter((strap) => strap.type === "strapping");
    const tieDown = plan.straps.filter((strap) => strap.type === "tieDown");

    expect(strapping).toHaveLength(2);
    expect(tieDown).toHaveLength(1);
    expect(underSecuredItemCount).toBe(0);

    // 围带竖向环绕货物本体：from 在顶面，to 在底面，X/Z 相同
    for (const strap of strapping) {
      expect(strap.fromPoint[0]).toBe(strap.toPoint[0]);
      expect(strap.fromPoint[2]).toBe(strap.toPoint[2]);
      expect(strap.fromPoint[1]).toBe(600); // 顶面
      expect(strap.toPoint[1]).toBe(0); // 底面
      expect(strap.presetCode).toBe("PET-Heavy");
      expect(strap.securedItems).toEqual([templates[0].id]);
    }
    // 首选位置：25% 与 75%
    expect(strapping[0].fromPoint[0]).toBeCloseTo(250);
    expect(strapping[1].fromPoint[0]).toBeCloseTo(750);

    // 拉紧器横贯箱宽
    expect(tieDown[0].presetCode).toBe("Ratchet-50");
    expect(tieDown[0].fromPoint[2]).toBe(0);
    expect(tieDown[0].toPoint[2]).toBe(2352);
    expect(tieDown[0].securedItems).toEqual([templates[0].id]);
  });

  it("被压货物不打带：叠放时只有顶层货物产生围带", () => {
    const bottom = makePlacedItem(0, 0, 0, 0, 0);
    // 顶层货物完全压在底层货物上方
    const top = makePlacedItem(1, 0, 0, 600, 0);
    const templates = [makeTemplate("00000000-0000-4000-8000-000000000000"), makeTemplate("00000000-0000-4000-8000-000000000001")];

    const { plan } = generateContainerLashingPlan(
      CONTAINER_ID,
      2352,
      [bottom.placement, top.placement],
      [bottom.aabb, top.aabb],
      makeTemplateMap(templates),
      LASHING_CONFIG,
    );

    const strapping = plan.straps.filter((strap) => strap.type === "strapping");
    // 只有顶层（index 1）被打带
    expect(strapping).toHaveLength(2);
    for (const strap of strapping) {
      expect(strap.fromPoint[1]).toBe(1200); // 顶层层顶
      expect(strap.toPoint[1]).toBe(600); // 顶层底
      expect(strap.securedItems).toEqual([templates[1].id]);
    }
  });

  it("物理约束：Z 向被相邻货物全阻挡时，回退到 X 向围带", () => {
    // 主货物 A 在 X 0..1000, Z 0..800；相邻货物 B 紧贴 A 的 +Z 侧面
    // （Z 800..1600），与 A 同长 → A 的 Z 向围带（下落段沿 ±Z 侧面）
    // 全部被 B 阻挡，必须回退到 X 向围带（下落段沿 ±X 侧面）
    const itemA = makePlacedItem(0, 0, 0, 0, 0);
    const itemB = makePlacedItem(1, 0, 0, 0, 800);
    const templates = [makeTemplate("00000000-0000-4000-8000-000000000000"), makeTemplate("00000000-0000-4000-8000-000000000001")];

    const { plan, underSecuredItemCount } = generateContainerLashingPlan(
      CONTAINER_ID,
      2352,
      [itemA.placement, itemB.placement],
      [itemA.aabb, itemB.aabb],
      makeTemplateMap(templates),
      LASHING_CONFIG,
    );

    expect(strapping(plan)).toHaveLength(4);
    expect(underSecuredItemCount).toBe(0);

    // A 的两道围带都是 X 向：平面 X = 货物中心 500，Z 在 A 的跨度内
    // A 的两道围带都是 X 向：环绕平面固定在 Z = 200 / 600（A 跨度的 25%/75%），
    // from/to 在同一竖直平面上（顶面 → 底面）
    const strapAXs = strapping(plan)
      .filter((strap) => strap.securedItems[0] === templates[0].id)
      .map((strap) => strap);
    expect(strapAXs).toHaveLength(2);
    expect(strapAXs.map((strap) => strap.fromPoint[2]).sort((a, b) => a - b)).toEqual([200, 600]);
    for (const strap of strapAXs) {
      expect(strap.fromPoint[0]).toBe(500);
      expect(strap.toPoint[0]).toBe(500);
      expect(strap.fromPoint[1]).toBe(600);
      expect(strap.toPoint[1]).toBe(0);
    }
  });

  it("拉紧器按 5 件一组：11 件暴露货物 → 3 道拉紧器", () => {
    const items = Array.from({ length: 11 }, (_, index) =>
      makePlacedItem(index, 0, index * 1100, 0, 0),
    );
    const templates = items.map((_, index) =>
      makeTemplate(`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`),
    );

    const { plan } = generateContainerLashingPlan(
      CONTAINER_ID,
      2352,
      items.map((item) => item.placement),
      items.map((item) => item.aabb),
      makeTemplateMap(templates),
      LASHING_CONFIG,
    );

    const tieDown = plan.straps.filter((strap) => strap.type === "tieDown");
    expect(tieDown).toHaveLength(3); // 5 + 5 + 1

    // 组内 securedItems 数量：5 / 5 / 1
    expect(tieDown[0].securedItems).toHaveLength(5);
    expect(tieDown[1].securedItems).toHaveLength(5);
    expect(tieDown[2].securedItems).toHaveLength(1);

    // 拉紧带高度不低于组内最高货物
    for (const strap of tieDown) {
      expect(strap.fromPoint[1]).toBeGreaterThanOrEqual(600);
    }
  });

  it("拉紧器高度抬升到该 X 列最高点，避免横贯线穿过高货物", () => {
    // 组中心附近放一件更高的货物
    const normal = makePlacedItem(0, 0, 0, 0, 0);
    const tall = makePlacedItem(1, 0, 200, 0, 0, { length: 1000, width: 800, height: 1500 });
    const templates = [makeTemplate("00000000-0000-4000-8000-000000000000"), makeTemplate("00000000-0000-4000-8000-000000000001")];

    const { plan } = generateContainerLashingPlan(
      CONTAINER_ID,
      2352,
      [normal.placement, tall.placement],
      [normal.aabb, tall.aabb],
      makeTemplateMap(templates),
      LASHING_CONFIG,
    );

    const tieDown = plan.straps.filter((strap) => strap.type === "tieDown");
    expect(tieDown).toHaveLength(1);
    expect(tieDown[0].fromPoint[1]).toBeGreaterThanOrEqual(1500);
    expect(tieDown[0].fromPoint[1]).toBe(tieDown[0].toPoint[1]);
  });
});

// ─── solve() 端到端集成 ──────────────────────────────────────

describe("solve() 集成扎带方案", () => {
  it("配置扎带时 solve() 输出非空 lashingPlan 且通过输出契约", () => {
    const container = {
      id: "22222222-2222-4222-8222-222222222222",
      name: "测试箱",
      length: 5898,
      width: 2352,
      height: 2393,
      maxPayload: 28000,
      tareWeight: 2200,
    };
    const cargo = {
      id: "00000000-0000-4000-8000-000000000009",
      modelId: "00000000-0000-4000-8000-000000000000",
      displayName: "测试货物",
      dimensions: { length: 1000, width: 800, height: 600 },
      weight: 100,
      quantity: 3,
      color: "#00ff00",
    };

    const result = solve({
      containers: [container],
      cargoList: [cargo],
      lashing: LASHING_CONFIG,
      constraints: { allowRotation: true, gravityCheck: true },
    });

    expect(result.success).toBe(true);
    expect(result.lashingPlan).toHaveLength(1);
    expect(result.lashingPlan[0].containerId).toBe(container.id);

    const strappingCount = result.lashingPlan[0].straps.filter(
      (strap) => strap.type === "strapping",
    ).length;
    expect(strappingCount).toBeGreaterThan(0);
  });

  it("未配置扎带时 lashingPlan 为空", () => {
    const container = {
      id: "22222222-2222-4222-8222-222222222222",
      name: "测试箱",
      length: 5898,
      width: 2352,
      height: 2393,
      maxPayload: 28000,
      tareWeight: 2200,
    };
    const cargo = {
      id: "00000000-0000-4000-8000-000000000009",
      modelId: "00000000-0000-4000-8000-000000000000",
      displayName: "测试货物",
      dimensions: { length: 1000, width: 800, height: 600 },
      weight: 100,
      quantity: 1,
      color: "#00ff00",
    };

    const result = solve({
      containers: [container],
      cargoList: [cargo],
      constraints: { allowRotation: true, gravityCheck: true },
    });

    expect(result.lashingPlan).toHaveLength(0);
  });
});
