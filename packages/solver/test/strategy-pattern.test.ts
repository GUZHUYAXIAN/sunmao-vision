/**
 * strategy-pattern.test.ts — 策略模式可插拔性与回归测试
 *
 * 验证目标：
 *   1. GuillotinePlacementStrategy 行为与旧实现完全等价（回归）
 *   2. SpiralPlacementStrategy 能在单层容器中正确放置货物
 *   3. 策略注册表 registerStrategy / getStrategy / listStrategies 工作正常
 *   4. packIntoContainer 在不传 strategy 参数时默认使用 Guillotine（向后兼容）
 *   5. packIntoContainer 在传入 SpiralStrategy 时使用螺旋搜索
 *   6. VoxelBody 基础操作（buildBoxVoxelBody / voxelIntersects / translate）
 */

import { describe, expect, it, beforeEach } from "vitest";
import type { Container, CargoTemplate } from "@sunmao/contracts";

import {
  GuillotinePlacementStrategy,
  SpiralPlacementStrategy,
  registerStrategy,
  getStrategy,
  listStrategies,
  packIntoContainer,
  buildBoxVoxelBody,
  buildLShapeVoxelBody,
  buildUShapeVoxelBody,
  voxelIntersects,
  voxelIntersectsFast,
  translateVoxelBody,
  computeVoxelBodyVolume,
} from "../src/index";
import type { EngineConfig } from "../src/placement-engine";

// ─────────────────────────────────────────────
// 测试夹具（Fixtures）
// ─────────────────────────────────────────────

function makeContainer(overrides: Partial<Container> = {}): Container {
  return {
    id: "test-container",
    name: "测试集装箱",
    type: "standard_20ft",
    length: 5900,
    height: 2390,
    width: 2350,
    maxPayload: 28000,
    tareWeight: 2200,
    ...overrides,
  };
}

function makeCargoTemplate(overrides: Partial<CargoTemplate> = {}): CargoTemplate {
  return {
    id: "cargo-1",
    name: "测试货物",
    dimensions: { length: 1000, height: 800, width: 600 },
    weight: 200,
    quantity: 1,
    stackable: true,
    fragile: false,
    ...overrides,
  };
}

function makeEngineConfig(container: Container, overrides?: Partial<EngineConfig>): EngineConfig {
  return {
    containerLength: container.length,
    containerHeight: container.height,
    containerWidth: container.width,
    allowRotation: true,
    maxStackLayers: undefined,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// §1 策略注册表
// ─────────────────────────────────────────────

describe("策略注册表", () => {
  beforeEach(() => {
    registerStrategy(new GuillotinePlacementStrategy());
    registerStrategy(new SpiralPlacementStrategy());
  });

  it("注册后 getStrategy 应返回正确实例", () => {
    const guillotine = getStrategy("guillotine");
    expect(guillotine).not.toBeNull();
    expect(guillotine?.name).toBe("guillotine");

    const spiral = getStrategy("spiral");
    expect(spiral).not.toBeNull();
    expect(spiral?.name).toBe("spiral");
  });

  it("getStrategy 未注册名称返回 null", () => {
    const unknown = getStrategy("nonexistent-strategy");
    expect(unknown).toBeNull();
  });

  it("listStrategies 包含所有已注册策略", () => {
    const names = listStrategies();
    expect(names).toContain("guillotine");
    expect(names).toContain("spiral");
  });
});

// ─────────────────────────────────────────────
// §2 GuillotinePlacementStrategy 单元测试
// ─────────────────────────────────────────────

describe("GuillotinePlacementStrategy", () => {
  const strategy = new GuillotinePlacementStrategy();

  it("name 应为 'guillotine'", () => {
    expect(strategy.name).toBe("guillotine");
  });

  it("在空容器中应返回 (0,0,0) 作为第一个放置位置", () => {
    const container = makeContainer();
    const item = { length: 1000, height: 800, width: 600, weight: 200 };
    const initialSlot = [{ x: 0, y: 0, z: 0, length: container.length, height: container.height, width: container.width }];

    const decision = strategy.findBestPlacement(
      item,
      initialSlot,
      { length: container.length, height: container.height, width: container.width },
      [],
      false,
    );

    expect(decision).not.toBeNull();
    expect(decision!.position).toEqual([0, 0, 0]);
  });

  it("货物超出容器时应返回 null", () => {
    const container = makeContainer({ length: 500, height: 500, width: 500 });
    const item = { length: 1000, height: 800, width: 600, weight: 200 };
    const initialSlot = [{ x: 0, y: 0, z: 0, length: container.length, height: container.height, width: container.width }];

    const decision = strategy.findBestPlacement(
      item,
      initialSlot,
      { length: container.length, height: container.height, width: container.width },
      [],
      false,
    );

    expect(decision).toBeNull();
  });

  it("afterPlacement 应从初始完整槽切割出正确子槽", () => {
    const container = makeContainer({ length: 2000, height: 2000, width: 2000 });
    const occupiedSlot = { x: 0, y: 0, z: 0, length: 1000, height: 1000, width: 1000 };
    const containerDim = { length: container.length, height: container.height, width: container.width };
    const fullSlot = [{ x: 0, y: 0, z: 0, ...containerDim }];

    const newSlots = strategy.afterPlacement(occupiedSlot, fullSlot, containerDim);

    expect(newSlots.length).toBeGreaterThan(0);
    // 切割后不应再有包含 (0,0,0) 的完整槽
    const hasFullSlot = newSlots.some(
      (slot) => slot.x === 0 && slot.y === 0 && slot.z === 0 && slot.length === 2000,
    );
    expect(hasFullSlot).toBe(false);
  });
});

// ─────────────────────────────────────────────
// §3 SpiralPlacementStrategy 单元测试
// ─────────────────────────────────────────────

describe("SpiralPlacementStrategy", () => {
  const strategy = new SpiralPlacementStrategy({ gridStepMm: 100 });

  it("name 应为 'spiral'", () => {
    expect(strategy.name).toBe("spiral");
  });

  it("在空容器中应能放置货物", () => {
    const container = makeContainer();
    const item = { length: 1000, height: 800, width: 600, weight: 200 };
    const containerDim = { length: container.length, height: container.height, width: container.width };

    const decision = strategy.findBestPlacement(item, [], containerDim, [], true);

    expect(decision).not.toBeNull();
    expect(decision!.position[1]).toBe(0); // 应在底层（Y=0）
  });

  it("afterPlacement 应直接返回原 freeSlots（螺旋策略不维护槽）", () => {
    const containerDim = { length: 5900, height: 2390, width: 2350 };
    const occupied = { x: 0, y: 0, z: 0, length: 1000, height: 800, width: 600 };
    const originalSlots = [{ x: 0, y: 0, z: 0, length: 5900, height: 2390, width: 2350 }];

    const result = strategy.afterPlacement(occupied, originalSlots, containerDim);

    expect(result).toBe(originalSlots); // 引用相同（不复制）
  });

  it("货物超出容器时应返回 null", () => {
    const containerDim = { length: 500, height: 500, width: 500 };
    const item = { length: 1000, height: 800, width: 600, weight: 200 };

    const decision = strategy.findBestPlacement(item, [], containerDim, [], false);

    expect(decision).toBeNull();
  });
});

// ─────────────────────────────────────────────
// §4 packIntoContainer 向后兼容性测试
// ─────────────────────────────────────────────

describe("packIntoContainer 策略注入", () => {
  it("不传 strategy 时默认使用 Guillotine 策略（向后兼容）", () => {
    const container = makeContainer();
    const cargo = makeCargoTemplate({ quantity: 3 });
    const config = makeEngineConfig(container);

    const result = packIntoContainer([{ template: cargo, quantity: 3, cargoIndex: 0 }], container, config);

    expect(result.placed.length).toBe(3);
    expect(result.unplaced.length).toBe(0);
  });

  it("传入 GuillotinePlacementStrategy 应与默认行为完全相同", () => {
    const container = makeContainer();
    const cargo = makeCargoTemplate({ quantity: 2 });
    const config = makeEngineConfig(container);
    const cargoList = [{ template: cargo, quantity: 2, cargoIndex: 0 }];

    const defaultResult = packIntoContainer(cargoList, container, config);
    const guilResult = packIntoContainer(cargoList, container, config, new GuillotinePlacementStrategy());

    expect(guilResult.placed.length).toBe(defaultResult.placed.length);
    expect(guilResult.unplaced.length).toBe(defaultResult.unplaced.length);

    for (let i = 0; i < guilResult.placed.length; i++) {
      const defPlacement = defaultResult.placed[i]!.placement;
      const guilPlacement = guilResult.placed[i]!.placement;
      expect(guilPlacement.position).toEqual(defPlacement.position);
      expect(guilPlacement.rotation).toEqual(defPlacement.rotation);
    }
  });

  it("传入 SpiralPlacementStrategy 应能放置货物", () => {
    const container = makeContainer();
    const cargo = makeCargoTemplate({ quantity: 2 });
    const config = makeEngineConfig(container);

    const result = packIntoContainer(
      [{ template: cargo, quantity: 2, cargoIndex: 0 }],
      container,
      config,
      new SpiralPlacementStrategy({ gridStepMm: 100 }),
    );

    expect(result.placed.length).toBe(2);
    expect(result.unplaced.length).toBe(0);
  });
});

// ─────────────────────────────────────────────
// §5 VoxelBody 体素碰撞模块测试
// ─────────────────────────────────────────────

describe("VoxelBody 体素碰撞", () => {
  it("buildBoxVoxelBody 应创建单个 subBox", () => {
    const voxel = buildBoxVoxelBody(0, 0, 0, 1000, 800, 600);
    expect(voxel.subBoxes.length).toBe(1);
    expect(voxel.subBoxes[0]!.minX).toBe(0);
    expect(voxel.subBoxes[0]!.maxX).toBe(1000);
  });

  it("voxelIntersects 应检测相互接触的体素体为 false（只接触不相交）", () => {
    const voxelA = buildBoxVoxelBody(0, 0, 0, 1000, 800, 600);
    // 紧贴右侧（minX = 1000 = maxX of A），应不相交（容差测试由 geometry 层负责）
    const voxelB = buildBoxVoxelBody(1000, 0, 0, 500, 800, 600);
    expect(voxelIntersects(voxelA, voxelB)).toBe(false);
  });

  it("voxelIntersects 应检测有重叠的体素体为 true", () => {
    const voxelA = buildBoxVoxelBody(0, 0, 0, 1000, 800, 600);
    const voxelB = buildBoxVoxelBody(500, 0, 0, 1000, 800, 600); // x 方向重叠 500mm
    expect(voxelIntersects(voxelA, voxelB)).toBe(true);
  });

  it("voxelIntersectsFast 粗筛通过后应与 voxelIntersects 结果一致", () => {
    const voxelA = buildBoxVoxelBody(0, 0, 0, 1000, 800, 600);
    const voxelB = buildBoxVoxelBody(500, 0, 0, 1000, 800, 600);
    expect(voxelIntersectsFast(voxelA, voxelB)).toBe(voxelIntersects(voxelA, voxelB));
  });

  it("translateVoxelBody 应按偏移量平移所有 subBox", () => {
    const voxel = buildBoxVoxelBody(0, 0, 0, 1000, 800, 600);
    const translated = translateVoxelBody(voxel, 100, 200, 300);
    expect(translated.subBoxes[0]!.minX).toBe(100);
    expect(translated.subBoxes[0]!.minY).toBe(200);
    expect(translated.subBoxes[0]!.minZ).toBe(300);
    expect(translated.subBoxes[0]!.maxX).toBe(1100);
  });

  it("computeVoxelBodyVolume 应计算正确体积", () => {
    const voxel = buildBoxVoxelBody(0, 0, 0, 1000, 800, 600);
    expect(computeVoxelBodyVolume(voxel)).toBe(1000 * 800 * 600);
  });

  it("buildLShapeVoxelBody 应创建两个 subBox", () => {
    const lShape = buildLShapeVoxelBody(2000, 500, 800, 1000, 600);
    expect(lShape.subBoxes.length).toBe(2);
  });

  it("buildUShapeVoxelBody 应创建三个 subBox", () => {
    const uShape = buildUShapeVoxelBody(2000, 300, 800, 400, 600);
    expect(uShape.subBoxes.length).toBe(3);
  });

  it("L 型与 Box 型体素体相交检测正确", () => {
    const lShape = buildLShapeVoxelBody(2000, 500, 800, 1000, 600);
    // Box 放在 L 型底座中间，应相交
    const overlapping = buildBoxVoxelBody(500, 100, 100, 500, 200, 400);
    expect(voxelIntersects(lShape, overlapping)).toBe(true);

    // Box 放在 L 型右上方，超出 L 型范围，不相交
    const separated = buildBoxVoxelBody(2100, 0, 0, 500, 500, 600);
    expect(voxelIntersects(lShape, separated)).toBe(false);
  });
});
