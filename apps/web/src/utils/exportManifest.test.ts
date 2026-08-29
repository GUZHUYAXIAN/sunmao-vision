/**
 * exportManifest.ts — 导出清单构建单元测试
 *
 * 验证：从 mockRequest + solve() 结果构建的清单能通过
 * ExportManifestSchema 契约校验，且各项统计数字自洽。
 */
import { describe, expect, it } from "vitest";
import { solve } from "@sunmao/solver";
import { ExportManifestSchema } from "@sunmao/contracts";
import { mockRequest } from "./mockData";
import { buildExportManifest } from "./exportManifest";

describe("buildExportManifest", () => {
  // mockRequest 自带扎带配置，solve() 会产出 lashingPlan
  const solveResult = solve(mockRequest);
  const manifest = buildExportManifest(mockRequest, solveResult);

  it("构建结果通过 ExportManifestSchema 契约校验", () => {
    // buildExportManifest 内部已 parse；这里再显式断言一次
    expect(() => ExportManifestSchema.parse(manifest)).not.toThrow();
  });

  it("只包含有货物的集装箱，且 grandTotal 自洽", () => {
    expect(manifest.containers.length).toBeGreaterThan(0);
    expect(manifest.grandTotal.totalContainers).toBe(manifest.containers.length);
    expect(manifest.grandTotal.totalItems).toBe(
      manifest.containers.reduce((sum, entry) => sum + entry.summary.itemCount, 0),
    );
    // 已放置的实例总数应与 solveResult 一致
    expect(manifest.grandTotal.totalItems).toBe(solveResult.placements.length);
  });

  it("清单条目逐件对应放置结果，尺寸/坐标/重量格式正确", () => {
    const firstContainer = manifest.containers[0];
    expect(firstContainer.items).toHaveLength(
      solveResult.placements.filter((p) => {
        const container = mockRequest.containers[0];
        return p.containerId === container.id;
      }).length,
    );

    for (const item of firstContainer.items) {
      expect(item.quantity).toBe(1);
      expect(item.totalWeight).toBe(item.unitWeight);
      // 尺寸描述 "L×W×H"
      expect(item.dimensions).toMatch(/^\d+(\.\d+)?×\d+(\.\d+)?×\d+(\.\d+)?$/);
      // 坐标描述 "(x, y, z)"
      expect(item.position).toMatch(/^\(-?\d+(\.\d+)?, -?\d+(\.\d+)?, -?\d+(\.\d+)?\)$/);
    }

    // 净重 = 各条目总重之和
    const expectedNet = firstContainer.items.reduce((sum, item) => sum + item.totalWeight, 0);
    expect(firstContainer.summary.netWeight).toBeCloseTo(expectedNet, 1);
  });

  it("有扎带配置时输出扎带用量，且数量与 lashingPlan 一致", () => {
    const firstContainer = manifest.containers[0];
    const planStrapCount = solveResult.lashingPlan
      .filter((plan) => plan.containerId === mockRequest.containers[0].id)
      .flatMap((plan) => plan.straps).length;

    expect(firstContainer.lashingUsed.length).toBeGreaterThan(0);
    const totalStraps = firstContainer.lashingUsed.reduce(
      (sum, used) => sum + Number(used.quantityOrLength.replace(/[^0-9]/g, "")),
      0,
    );
    expect(totalStraps).toBe(planStrapCount);
  });

  it("毛重 = 净重 + 扎带重 + 皮重（与 solver 统计一致）", () => {
    for (const container of manifest.containers) {
      const stats = solveResult.statistics.perContainer.find(
        (entry) => entry.containerId === mockRequest.containers[0].id,
      );
      if (container === manifest.containers[0] && stats) {
        expect(container.summary.grossWeight).toBeCloseTo(stats.grossWeight, 1);
        expect(container.summary.utilization).toBeCloseTo(stats.utilization, 1);
      }
    }
  });
});
