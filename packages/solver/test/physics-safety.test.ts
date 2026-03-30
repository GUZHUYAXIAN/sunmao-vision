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
