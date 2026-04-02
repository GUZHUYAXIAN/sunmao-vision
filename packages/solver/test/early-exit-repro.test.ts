/**
 * early-exit-repro.test.ts — "早退罢工 Bug" 最小复现测试
 *
 * 场景：集装箱缩小后，大货物装不下，但小货物明明能装下，
 *       却被系统全部扔进 unplacedItems，集装箱变成全空。
 */
import { describe, expect, test } from "vitest";
import { solve } from "../src/solve";
import type { SolveRequest } from "@sunmao/contracts";

function makeRequest(overrides?: Partial<SolveRequest>): SolveRequest {
  const base: SolveRequest = {
    containers: [
      {
        id: "c1",
        name: "小集装箱",
        length: 600,
        width: 600,
        height: 600,
        maxPayload: 99999,
        tareWeight: 0,
      },
    ],
    cargoList: [
      {
        id: "big-cargo",
        modelId: "10000000-0000-4000-8000-000000000001",
        displayName: "大货物（装不下）",
        dimensions: { length: 800, width: 800, height: 800 },
        weight: 10,
        quantity: 1,
        color: "#FF0000",
      },
      {
        id: "small-cargo",
        modelId: "10000000-0000-4000-8000-000000000001",
        displayName: "小货物（能装下）",
        dimensions: { length: 200, width: 200, height: 200 },
        weight: 10,
        quantity: 3,
        color: "#00FF00",
      },
    ],
    constraints: {
      allowRotation: false,
      gravityCheck: false,
    },
    // lashing 为可选字段，不传则扎带重量计为 0
    ...overrides,
  };
  return base;
}

describe("P0-F 早退罢工 Bug 复现 — 大货物失败不应阻止小货物放置", () => {
  test("大货物装不下时，小货物应仍然被成功放置", () => {
    const result = solve(makeRequest());

    // 大货物装不下（800 > 600），必须进 unplaced
    const bigUnplaced = result.unplacedItems.filter((u) => u.cargoIndex === 0);
    expect(bigUnplaced).toHaveLength(1);

    // 小货物（200mm，集装箱 600mm，可以放 3×3×3=27 个，至少能放 3 个）
    // 关键断言：placements 不能是空！
    expect(result.placements.length).toBeGreaterThan(0);

    // 3 个小货物都应该能装下
    const smallPlaced = result.placements.filter((p) => p.cargoIndex === 1);
    expect(smallPlaced).toHaveLength(3);
  });

  test("多种尺寸混合时，能装的货物不因排序靠后而被丢弃", () => {
    // 极端场景：5 个超大 + 10 个超小，超大全失败，超小全应成功
    const request = makeRequest({
      containers: [
        {
          id: "c2",
          name: "窄箱",
          length: 300,
          width: 300,
          height: 300,
          maxPayload: 99999,
          tareWeight: 0,
        },
      ],
      cargoList: [
        {
          id: "oversized",
          modelId: "10000000-0000-4000-8000-000000000001",
          displayName: "超大件",
          dimensions: { length: 500, width: 500, height: 500 },
          weight: 5,
          quantity: 3,
          color: "#FF0000",
        },
        {
          id: "tiny",
          modelId: "10000000-0000-4000-8000-000000000001",
          displayName: "超小件",
          dimensions: { length: 100, width: 100, height: 100 },
          weight: 1,
          quantity: 8,
          color: "#00FF00",
        },
      ],
    });

    const result = solve(request);

    // 超大件全部失败
    const oversizedUnplaced = result.unplacedItems.filter((u) => u.cargoIndex === 0);
    expect(oversizedUnplaced).toHaveLength(3);

    // 超小件（100mm，箱子 300mm）至少可以放 27 个，8 个全应成功
    const tinyPlaced = result.placements.filter((p) => p.cargoIndex === 1);
    expect(tinyPlaced).toHaveLength(8);

    // 系统级断言：placements 非空
    expect(result.placements.length).toBeGreaterThan(0);
  });
});
