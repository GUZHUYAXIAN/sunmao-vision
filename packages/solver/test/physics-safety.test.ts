import { describe, expect, test } from "vitest";
import type { CargoTemplate, Container } from "@sunmao/contracts";
import { aabbIntersects, isWithinContainer, makeAabb } from "../src/geometry";
import { hasSufficientBottomSupport, computeBottomSupportCheck } from "../src/weight-checker";
import { packIntoContainer, type EngineConfig } from "../src/placement-engine";

function createContainer(overrides: Partial<Container> = {}): Container {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "测试集装箱",
    length: 100,
    width: 100,
    height: 100,
    maxPayload: 10_000,
    tareWeight: 0,
    ...overrides,
  };
}

function createCargoTemplate(
  id: string,
  dimensions: { length: number; width: number; height: number },
  weight = 100,
): CargoTemplate {
  return {
    id,
    modelId: "10000000-0000-4000-8000-000000000001",
    displayName: `货物-${id}`,
    dimensions,
    weight,
    quantity: 1,
    color: "#3366FF",
  };
}

const defaultEngineConfig: EngineConfig = {
  containerLength: 100,
  containerWidth: 100,
  containerHeight: 100,
  allowRotation: false,
  maxStackLayers: undefined,
};

// ─────────────────────────────────────────────
// P0-A: 几何精度安全（浮点容差修复）
// ─────────────────────────────────────────────

describe("几何精度安全 (P0-A fix)", () => {
  test("浮点贴边不应被误判为越界或重叠", () => {
    const edgeAlignedBox = makeAabb(0, 0, 0, 0.1 + 0.2, 1, 1);
    const touchingNeighbor = makeAabb(0.3, 0, 0, 1, 1, 1);

    // 0.1 + 0.2 = 0.30000000000000004，容差修复后：
    //   - 应视为在容器内（不越界）
    //   - 与 minX=0.3 的邻居应视为面贴面，不相交
    expect(isWithinContainer(edgeAlignedBox, 0.3, 1, 1)).toBe(true);
    expect(aabbIntersects(edgeAlignedBox, touchingNeighbor)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// P0-B: 底面支撑安全（悬空拦截修复）
// ─────────────────────────────────────────────

describe("底面支撑安全 (P0-B fix)", () => {
  test("上层货物底面未被完整支撑时必须拒绝放置", () => {
    const container = createContainer({ length: 100, width: 100, height: 200 });
    const engineConfig: EngineConfig = {
      ...defaultEngineConfig,
      containerLength: container.length,
      containerWidth: container.width,
      containerHeight: container.height,
    };

    const smallSupport = createCargoTemplate(
      "20000000-0000-4000-8000-000000000001",
      { length: 20, width: 20, height: 20 },
    );
    const floatingSlab = createCargoTemplate(
      "20000000-0000-4000-8000-000000000002",
      { length: 100, width: 100, height: 20 },
    );

    const result = packIntoContainer(
      [
        { template: smallSupport, quantity: 1, cargoIndex: 0 },
        { template: floatingSlab, quantity: 1, cargoIndex: 1 },
      ],
      container,
      engineConfig,
    );

    // 小支撑块放下后，大板子因底面支撑率不足（仅 4%）应被拒绝
    expect(result.placed).toHaveLength(1);
    expect(result.unplaced).toHaveLength(1);
    expect(result.unplaced[0]?.cargoIndex).toBe(1);
  });

  test("落地货物底面支撑率恒为 1", () => {
    const groundBox = makeAabb(0, 0, 0, 100, 50, 100);
    const check = computeBottomSupportCheck(groundBox, []);
    expect(check.supportedByFloor).toBe(true);
    expect(check.supportRatio).toBe(1);
    expect(check.isCenterSupported).toBe(true);
  });

  test("大板压在小角上应判断为支撑不足", () => {
    // 下层：小角支撑 [0,0,0]→[20,50,20]
    const cornerSupport = makeAabb(0, 0, 0, 20, 50, 20);
    // 上层：大板 [0,50,0]→[100,70,100]，底面中心 (50, 50) 不在支撑投影内
    const bigPlate = makeAabb(0, 50, 0, 100, 70, 100);

    expect(hasSufficientBottomSupport(bigPlate, [cornerSupport])).toBe(false);
  });

  test("多个下层支撑面拼成完整底面时允许上层放置", () => {
    const container = createContainer({ length: 200, width: 100, height: 200 });
    const engineConfig: EngineConfig = {
      ...defaultEngineConfig,
      containerLength: container.length,
      containerWidth: container.width,
      containerHeight: container.height,
    };

    const baseHalf = createCargoTemplate(
      "30000000-0000-4000-8000-000000000001",
      { length: 100, width: 100, height: 50 },
    );
    const topBridge = createCargoTemplate(
      "30000000-0000-4000-8000-000000000002",
      { length: 200, width: 100, height: 50 },
    );

    const result = packIntoContainer(
      [
        { template: baseHalf, quantity: 2, cargoIndex: 0 },
        { template: topBridge, quantity: 1, cargoIndex: 1 },
      ],
      container,
      engineConfig,
    );

    expect(result.placed).toHaveLength(3);
    expect(result.unplaced).toHaveLength(0);
    // 桥接板应放在 y=50 层
    expect(result.placed[2]?.placement.position[1]).toBe(50);
  });
});

// ─────────────────────────────────────────────
// P1: maxStackLayers 不再空转（层数限制修复）
// ─────────────────────────────────────────────

describe("堆叠层数限制 (P1 fix — maxStackLayers not vacuous)", () => {
  /**
   * 旧 Bug：slot.y < layerHeight * maxStackLayers 等价于 slot.y < containerHeight，
   * 这个过滤永远成立，层数限制形同虚设。
   *
   * 修复后：maxAllowedBottomY = singleLayerHeight * (maxStackLayers - 1)，
   * y > maxAllowedBottomY 的槽被过滤，货物无法从上层起始位置放置。
   */
  test("maxStackLayers=1 时只允许放置在第 0 层起始位置（y=0）", () => {
    // 容器 100×200×100，maxStackLayers=1
    // singleLayerHeight=200，maxAllowedBottomY=0
    // 第一件 50mm 高的货物落地，第二件货物的起始 y=50，超出限制，应被拒绝
    const container = createContainer({ length: 100, width: 100, height: 200 });
    const engineConfig: EngineConfig = {
      ...defaultEngineConfig,
      containerLength: container.length,
      containerWidth: container.width,
      containerHeight: container.height,
      maxStackLayers: 1,
    };

    const bottomBox = createCargoTemplate(
      "40000000-0000-4000-8000-000000000001",
      { length: 100, width: 100, height: 50 },
    );
    const secondBox = createCargoTemplate(
      "40000000-0000-4000-8000-000000000002",
      { length: 50, width: 50, height: 50 },
    );

    const result = packIntoContainer(
      [
        { template: bottomBox, quantity: 1, cargoIndex: 0 },
        { template: secondBox, quantity: 1, cargoIndex: 1 },
      ],
      container,
      engineConfig,
    );

    // 第一件占满地板；第二件无论摆在哪里都 y=0 的位置已被占满，
    // 而 maxStackLayers=1 限制不允许从 y>0 开始放置，应 unplaced
    expect(result.placed).toHaveLength(1);
    expect(result.unplaced).toHaveLength(1);
    expect(result.unplaced[0]?.reason).toContain("最大堆叠层数限制");
  });

  test("maxStackLayers=2 时允许第二层货物正常放置", () => {
    const container = createContainer({ length: 100, width: 100, height: 200 });
    const engineConfig: EngineConfig = {
      ...defaultEngineConfig,
      containerLength: container.length,
      containerWidth: container.width,
      containerHeight: container.height,
      maxStackLayers: 2,
    };

    const layer0Box = createCargoTemplate(
      "50000000-0000-4000-8000-000000000001",
      { length: 100, width: 100, height: 100 },
    );
    const layer1Box = createCargoTemplate(
      "50000000-0000-4000-8000-000000000002",
      { length: 100, width: 100, height: 50 },
    );

    const result = packIntoContainer(
      [
        { template: layer0Box, quantity: 1, cargoIndex: 0 },
        { template: layer1Box, quantity: 1, cargoIndex: 1 },
      ],
      container,
      engineConfig,
    );

    // maxStackLayers=2，第二层起始 y=100 <= singleLayerHeight*(2-1)=100，允许
    expect(result.placed).toHaveLength(2);
    expect(result.unplaced).toHaveLength(0);
    expect(result.placed[1]?.placement.position[1]).toBe(100);
  });
});

// ─────────────────────────────────────────────
// M4 P0-Bug1: 贪心早退（小货物被槽门槛过滤）
// ─────────────────────────────────────────────

describe("贪心早退修复 (M4-P0-Bug1 — MINIMUM_SLOT_DIMENSION_MM 从 80 降为 1)", () => {
  test("缩小集装箱后，尺寸适配的小货物必须被成功放置（不因槽被过滤而返回全空）", () => {
    const container = createContainer({ length: 100, width: 100, height: 100 });
    const engineConfig: EngineConfig = {
      containerLength: container.length,
      containerWidth: container.width,
      containerHeight: container.height,
      allowRotation: false,
      maxStackLayers: undefined,
    };

    const smallBoxA = createCargoTemplate(
      "60000000-0000-4000-8000-000000000001",
      { length: 50, width: 100, height: 50 },
    );
    const smallBoxB = createCargoTemplate(
      "60000000-0000-4000-8000-000000000002",
      { length: 50, width: 100, height: 50 },
    );

    const result = packIntoContainer(
      [
        { template: smallBoxA, quantity: 1, cargoIndex: 0 },
        { template: smallBoxB, quantity: 1, cargoIndex: 1 },
      ],
      container,
      engineConfig,
    );

    expect(result.placed).toHaveLength(2);
    expect(result.unplaced).toHaveLength(0);
  });

  test("4 件 50mm 小货物铺满底层后，顶层 100mm 货物也能正确放置", () => {
    const container = createContainer({ length: 100, width: 100, height: 100 });
    const engineConfig: EngineConfig = {
      containerLength: container.length,
      containerWidth: container.width,
      containerHeight: container.height,
      allowRotation: false,
      maxStackLayers: undefined,
    };

    const floorBox = createCargoTemplate(
      "70000000-0000-4000-8000-000000000001",
      { length: 50, width: 50, height: 50 },
    );
    const topBox = createCargoTemplate(
      "70000000-0000-4000-8000-000000000002",
      { length: 100, width: 100, height: 50 },
    );

    const result = packIntoContainer(
      [
        { template: floorBox, quantity: 4, cargoIndex: 0 },
        { template: topBox, quantity: 1, cargoIndex: 1 },
      ],
      container,
      engineConfig,
    );

    expect(result.placed).toHaveLength(5);
    expect(result.unplaced).toHaveLength(0);
    const topItem = result.placed.find((item) => item.cargoIndex === 1);
    expect(topItem?.placement.position[1]).toBe(50);
  });
});

// ─────────────────────────────────────────────
// M4 P0-Bug2: Y 轴下方切割遗漏导致穿模
// ─────────────────────────────────────────────

describe("穿模修复 (M4-P0-Bug2 — Y 轴下方残余槽不被吞掉)", () => {
  test("放置高层货物后，其 Y 轴上方的合法空间不应消失，两件货物不应穿模", () => {
    const container = createContainer({ length: 100, width: 100, height: 200 });
    const engineConfig: EngineConfig = {
      containerLength: container.length,
      containerWidth: container.width,
      containerHeight: container.height,
      allowRotation: false,
      maxStackLayers: undefined,
    };

    const baseBlock = createCargoTemplate(
      "80000000-0000-4000-8000-000000000001",
      { length: 100, width: 100, height: 100 },
    );
    const topSmall = createCargoTemplate(
      "80000000-0000-4000-8000-000000000002",
      { length: 50, width: 50, height: 50 },
    );

    const result = packIntoContainer(
      [
        { template: baseBlock, quantity: 1, cargoIndex: 0 },
        { template: topSmall, quantity: 1, cargoIndex: 1 },
      ],
      container,
      engineConfig,
    );

    expect(result.placed).toHaveLength(2);
    expect(result.unplaced).toHaveLength(0);

    const aabb0 = result.placed[0]!.occupiedAabb;
    const aabb1 = result.placed[1]!.occupiedAabb;
    expect(aabbIntersects(aabb0, aabb1)).toBe(false);
    expect(result.placed[1]!.placement.position[1]).toBe(100);
  });

  test("三个同尺寸货物垂直叠放时，任意两件不应相交且 Y 坐标必须为 0/100/200", () => {
    const container = createContainer({ length: 100, width: 100, height: 300 });
    const engineConfig: EngineConfig = {
      containerLength: container.length,
      containerWidth: container.width,
      containerHeight: container.height,
      allowRotation: false,
      maxStackLayers: undefined,
    };

    const slab = createCargoTemplate(
      "90000000-0000-4000-8000-000000000001",
      { length: 100, width: 100, height: 100 },
    );

    const result = packIntoContainer(
      [{ template: slab, quantity: 3, cargoIndex: 0 }],
      container,
      engineConfig,
    );

    expect(result.placed).toHaveLength(3);
    expect(result.unplaced).toHaveLength(0);

    const aabbs = result.placed.map((item) => item.occupiedAabb);
    for (let firstIndex = 0; firstIndex < aabbs.length; firstIndex++) {
      for (let secondIndex = firstIndex + 1; secondIndex < aabbs.length; secondIndex++) {
        expect(aabbIntersects(aabbs[firstIndex]!, aabbs[secondIndex]!)).toBe(false);
      }
    }

    const yPositions = result.placed
      .map((item) => item.placement.position[1])
      .sort((yA, yB) => yA - yB);
    expect(yPositions).toEqual([0, 100, 200]);
  });
});
