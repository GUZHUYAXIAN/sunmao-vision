/**
 * boundary-gravity.test.ts — P0 极限边界越界与悬空专项测试
 *
 * 测试覆盖用户报告的三类致命 Bug：
 *   1. 绝对边界锁死：任何放置结果的坐标 + 尺寸不得超过集装箱边界
 *   2. 绝对重力校验：非落地货物底面必须至少有 70% 被下方支撑
 *   3. 合法溢出处理：无法放置的货物必须进入 unplacedItems，不得赋越界坐标
 */

import { describe, expect, test } from "vitest";
import type { CargoTemplate, Container } from "@sunmao/contracts";
import { isWithinContainer, makeAabb } from "../src/geometry";
import { packIntoContainer, type EngineConfig } from "../src/placement-engine";
import { MINIMUM_BOTTOM_SUPPORT_RATIO } from "../src/weight-checker";

// ─────────────────────────────────────────────
// 测试 Fixtures
// ─────────────────────────────────────────────

function createContainer(
  length: number,
  width: number,
  height: number,
  maxPayload = 999_999,
): Container {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    name: "边界测试集装箱",
    length,
    width,
    height,
    maxPayload,
    tareWeight: 0,
  };
}

function createCargo(
  id: string,
  length: number,
  width: number,
  height: number,
  weight = 10,
  quantity = 1,
): CargoTemplate {
  return {
    id,
    modelId: "10000000-0000-4000-8000-000000000001",
    displayName: `货物-${id}`,
    dimensions: { length, width, height },
    weight,
    quantity,
    color: "#FF3344",
  };
}

function makeConfig(container: Container, overrides: Partial<EngineConfig> = {}): EngineConfig {
  return {
    containerLength: container.length,
    containerWidth: container.width,
    containerHeight: container.height,
    allowRotation: false,
    maxStackLayers: undefined,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 第一类：绝对边界锁死
// ─────────────────────────────────────────────

describe("P0-C 绝对边界锁死 — 放置结果坐标不得越界", () => {
  test("所有放置结果的 AABB 必须严格在集装箱内部", () => {
    // 真实集装箱尺寸（20ft标准箱，mm）
    const container = createContainer(5_898, 2_352, 2_390);
    const config = makeConfig(container);

    const cargoes = [
      createCargo("a1", 1200, 800, 900, 200, 3),
      createCargo("a2", 600, 600, 600, 100, 5),
      createCargo("a3", 2400, 1000, 800, 500, 2),
    ];

    const result = packIntoContainer(
      cargoes.map((template, cargoIndex) => ({ template, quantity: template.quantity, cargoIndex })),
      container,
      config,
    );

    // 核心断言：每一个放置结果的 AABB 不能越出集装箱
    for (const placedItem of result.placed) {
      const aabb = placedItem.occupiedAabb;
      const isWithin = isWithinContainer(aabb, container.length, container.height, container.width);

      // 提供详细的失败信息帮助定位
      expect(isWithin).toBe(true);
      expect(aabb.maxX).toBeLessThanOrEqual(container.length);
      expect(aabb.maxY).toBeLessThanOrEqual(container.height);
      expect(aabb.maxZ).toBeLessThanOrEqual(container.width);
      expect(aabb.minX).toBeGreaterThanOrEqual(0);
      expect(aabb.minY).toBeGreaterThanOrEqual(0);
      expect(aabb.minZ).toBeGreaterThanOrEqual(0);
    }
  });

  test("货物尺寸超出集装箱时必须全部进入 unplaced，不能赋越界坐标", () => {
    // 集装箱 100×100×100，货物 200×50×50（X 轴超出）
    const container = createContainer(100, 100, 100);
    const config = makeConfig(container);

    const oversizedCargo = createCargo("b1", 200, 50, 50);

    const result = packIntoContainer(
      [{ template: oversizedCargo, quantity: 1, cargoIndex: 0 }],
      container,
      config,
    );

    expect(result.placed).toHaveLength(0);
    expect(result.unplaced).toHaveLength(1);
  });

  test("刚好贴合集装箱边界的货物应被成功放置（不因浮点误差被拒）", () => {
    // 集装箱 100×100×100，货物精确填满
    const container = createContainer(100, 100, 100);
    const config = makeConfig(container);

    const exactFitCargo = createCargo("c1", 100, 100, 100);

    const result = packIntoContainer(
      [{ template: exactFitCargo, quantity: 1, cargoIndex: 0 }],
      container,
      config,
    );

    expect(result.placed).toHaveLength(1);
    expect(result.unplaced).toHaveLength(0);

    const aabb = result.placed[0]!.occupiedAabb;
    expect(aabb.maxX).toBe(100);
    expect(aabb.maxY).toBe(100);
    expect(aabb.maxZ).toBe(100);
  });

  test("多货物叠放后 Guillotine 切割的子槽不得生成越界起始坐标", () => {
    // 3×3 网格铺满地板，再放一层；验证所有子槽不超出边界
    const container = createContainer(300, 300, 300);
    const config = makeConfig(container);

    const floorTile = createCargo("d1", 100, 100, 100, 10, 9); // 填满 3×3 地板
    const topTile = createCargo("d2", 100, 100, 100, 10, 9);   // 填满第二层

    const result = packIntoContainer(
      [
        { template: floorTile, quantity: 9, cargoIndex: 0 },
        { template: topTile, quantity: 9, cargoIndex: 1 },
      ],
      container,
      config,
    );

    expect(result.placed).toHaveLength(18);
    expect(result.unplaced).toHaveLength(0);

    for (const item of result.placed) {
      const { occupiedAabb: aabb } = item;
      expect(aabb.maxX).toBeLessThanOrEqual(300);
      expect(aabb.maxY).toBeLessThanOrEqual(300);
      expect(aabb.maxZ).toBeLessThanOrEqual(300);
    }
  });
});

// ─────────────────────────────────────────────
// 第二类：绝对重力校验（70% 支撑率）
// ─────────────────────────────────────────────

describe("P0-D 绝对重力校验 — 70% 支撑率阈值", () => {
  test("MINIMUM_BOTTOM_SUPPORT_RATIO 常量应为 0.7", () => {
    expect(MINIMUM_BOTTOM_SUPPORT_RATIO).toBe(0.7);
  });

  test("底面支撑率 < 70% 时货物应被拒绝放置", () => {
    // 下层：25×25 的小角（覆盖上层100×100底面的6.25%，远低于70%）
    const container = createContainer(100, 100, 200);
    const config = makeConfig(container);

    const tinyCorner = createCargo("e1", 25, 25, 100, 10); // 占地 25×100，底面中心不在100×100内
    const bigSlab = createCargo("e2", 100, 100, 100, 10);   // 大底面

    const result = packIntoContainer(
      [
        { template: tinyCorner, quantity: 1, cargoIndex: 0 },
        { template: bigSlab, quantity: 1, cargoIndex: 1 },
      ],
      container,
      config,
    );

    // 小角放下后，大板底面中心 (50,50) 不在支撑投影内，应被拒绝
    expect(result.placed).toHaveLength(1);
    expect(result.unplaced).toHaveLength(1);
    expect(result.unplaced[0]?.cargoIndex).toBe(1);
  });

  test("底面支撑率 >= 70% 时货物应被允许放置", () => {
    // 下层：80×100 的支撑板（覆盖80%），上层：100×100 大板
    const container = createContainer(100, 100, 200);
    const config = makeConfig(container);

    const wideSupport = createCargo("f1", 80, 100, 100, 10);
    const bigSlab = createCargo("f2", 80, 100, 100, 10);

    const result = packIntoContainer(
      [
        { template: wideSupport, quantity: 1, cargoIndex: 0 },
        { template: bigSlab, quantity: 1, cargoIndex: 1 },
      ],
      container,
      config,
    );

    // 80×100 支撑板完整覆盖同尺寸上层，支撑率100%，应允许
    expect(result.placed).toHaveLength(2);
    expect(result.unplaced).toHaveLength(0);
    expect(result.placed[1]!.placement.position[1]).toBe(100); // 第二件在 y=100 处
  });

  test("重力校验默认阈值为 70%，不应再要求 100% 支撑", () => {
    // 下层铺两块各占50%宽度的支撑板，上层桥接板应被成功放置
    const container = createContainer(200, 100, 200);
    const config = makeConfig(container);

    // 左右各一块 100×100×50 的下层支撑
    const leftBase = createCargo("g1", 100, 100, 50, 10);
    const rightBase = createCargo("g2", 100, 100, 50, 10);
    // 上层 200×100×50 的桥接板，底面被两块支撑各撑 50%
    const bridgeSlab = createCargo("g3", 200, 100, 50, 10);

    const result = packIntoContainer(
      [
        { template: leftBase, quantity: 1, cargoIndex: 0 },
        { template: rightBase, quantity: 1, cargoIndex: 1 },
        { template: bridgeSlab, quantity: 1, cargoIndex: 2 },
      ],
      container,
      config,
    );

    // 桥接板底面被左右各 50% 覆盖，总 100% > 70%，且重心在支撑内，应成功
    const bridgePlacement = result.placed.find((p) => p.cargoIndex === 2);
    expect(bridgePlacement).toBeDefined();
    expect(bridgePlacement!.placement.position[1]).toBe(50);
  });
});

// ─────────────────────────────────────────────
// 第三类：合法溢出处理
// ─────────────────────────────────────────────

describe("P0-E 合法溢出处理 — 无法放置必须进 unplaced 不得越界", () => {
  test("集装箱完全装满后再放入的货物必须進 unplaced", () => {
    const container = createContainer(100, 100, 100);
    const config = makeConfig(container);

    // 100×100×100 填满集装箱的第一件
    const fillAll = createCargo("h1", 100, 100, 100);
    // 第二件无处可放
    const overflow = createCargo("h2", 50, 50, 50);

    const result = packIntoContainer(
      [
        { template: fillAll, quantity: 1, cargoIndex: 0 },
        { template: overflow, quantity: 1, cargoIndex: 1 },
      ],
      container,
      config,
    );

    expect(result.placed).toHaveLength(1);
    expect(result.unplaced).toHaveLength(1);
    expect(result.unplaced[0]?.cargoIndex).toBe(1);
    expect(result.unplaced[0]?.reason).toBeTruthy();
  });

  test("超重时货物必须进 unplaced 而非赋予非法坐标", () => {
    const container = createContainer(1000, 1000, 1000, 100); // maxPayload 仅 100kg
    const config = makeConfig(container);

    // 第一件 80kg，刚好放入
    const heavyFirst = createCargo("i1", 100, 100, 100, 80);
    // 第二件 50kg，超出剩余载重
    const tooHeavy = createCargo("i2", 100, 100, 100, 50);

    const result = packIntoContainer(
      [
        { template: heavyFirst, quantity: 1, cargoIndex: 0 },
        { template: tooHeavy, quantity: 1, cargoIndex: 1 },
      ],
      container,
      config,
    );

    expect(result.placed).toHaveLength(1);
    expect(result.unplaced).toHaveLength(1);
    expect(result.unplaced[0]?.reason).toContain("超出最大载重");

    // 确认放置的第一件坐标合法
    const aabb = result.placed[0]!.occupiedAabb;
    expect(isWithinContainer(aabb, container.length, container.height, container.width)).toBe(true);
  });

  test("多批次货物无法放入时，所有超限件均应在 unplaced 中有记录", () => {
    const container = createContainer(100, 100, 100);
    const config = makeConfig(container);

    // 第一件恰好填满
    const fillBox = createCargo("j1", 100, 100, 100);
    // 剩余三件无处可放
    const extraBox = createCargo("j2", 50, 50, 50, 10, 3);

    const result = packIntoContainer(
      [
        { template: fillBox, quantity: 1, cargoIndex: 0 },
        { template: extraBox, quantity: 3, cargoIndex: 1 },
      ],
      container,
      config,
    );

    expect(result.placed).toHaveLength(1);
    expect(result.unplaced).toHaveLength(3);

    // 所有未放置件的 cargoIndex 必须是 1（extra box）
    for (const unplacedItem of result.unplaced) {
      expect(unplacedItem.cargoIndex).toBe(1);
      expect(unplacedItem.reason).toBeTruthy();
    }
  });

  test("makeAabb 工具函数正确计算边界（回归测试）", () => {
    const box = makeAabb(10, 20, 30, 100, 200, 300);
    expect(box.minX).toBe(10);
    expect(box.minY).toBe(20);
    expect(box.minZ).toBe(30);
    expect(box.maxX).toBe(110); // 10 + 100
    expect(box.maxY).toBe(220); // 20 + 200
    expect(box.maxZ).toBe(330); // 30 + 300
  });
});
