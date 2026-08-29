/**
 * useDragInteraction 纯函数单元测试
 *
 * 覆盖网格吸附（Shift 触发的 snapToGrid）与集装箱内边界钳制
 * （clampToContainerBounds）。Three.js / React 相关部分依赖真实
 * 渲染环境，不在此文件覆盖。
 */
import { describe, it, expect } from 'vitest';
import { snapToGrid, clampToContainerBounds } from './useDragInteraction';
import type { ContainerBounds2D } from './useDragInteraction';

describe('snapToGrid（Shift 网格吸附）', () => {
  it('应吸附到 50mm 网格步长', () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(50)).toBe(50);
    expect(snapToGrid(74)).toBe(50);
    expect(snapToGrid(75)).toBe(100);
    expect(snapToGrid(1234)).toBe(1250);
  });

  it('负值也应正确吸附（注意 JS Math.round(-1.5) 向 +∞ 取整）', () => {
    expect(snapToGrid(-74)).toBe(-50);
    expect(snapToGrid(-75)).toBe(-50); // Math.round(-1.5) === -1
    expect(snapToGrid(-76)).toBe(-100);
  });
});

describe('clampToContainerBounds（集装箱内边界钳制）', () => {
  // 箱体原点 (1000, 0)，内部尺寸 5898 × 2352
  const bounds: ContainerBounds2D = {
    originX: 1000,
    originZ: 0,
    length: 5898,
    width: 2352,
  };
  const halfX = 600;
  const halfZ = 400;

  it('箱内位置不移动', () => {
    const result = clampToContainerBounds(3000, 1200, halfX, halfZ, bounds);
    expect(result.x).toBe(3000);
    expect(result.z).toBe(1200);
  });

  it('超出 X 正方向时钳制到箱壁内侧', () => {
    const result = clampToContainerBounds(99999, 1200, halfX, halfZ, bounds);
    expect(result.x).toBe(1000 + 5898 - halfX); // 6298
  });

  it('超出 X 负方向时钳制到箱壁内侧（考虑箱体世界偏移）', () => {
    const result = clampToContainerBounds(-99999, 1200, halfX, halfZ, bounds);
    expect(result.x).toBe(1000 + halfX); // 1600
  });

  it('超出 Z 方向时钳制到箱壁内侧', () => {
    const result = clampToContainerBounds(3000, -99999, halfX, halfZ, bounds);
    expect(result.z).toBe(halfZ); // 400

    const result2 = clampToContainerBounds(3000, 99999, halfX, halfZ, bounds);
    expect(result2.z).toBe(2352 - halfZ); // 1952
  });

  it('货物比集装箱还大时钳制到中点（行为确定，不产生 NaN）', () => {
    const result = clampToContainerBounds(3000, 1200, 99999, 99999, bounds);
    // min > max 时 clamp 区间取 (min, max) 排序后的中段，值必须有限
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Number.isFinite(result.z)).toBe(true);
  });
});
