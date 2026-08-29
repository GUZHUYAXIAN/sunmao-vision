/**
 * useProjectStore 撤销/重做历史栈单元测试
 *
 * 验证：所有会改变 project 的操作都进入 past 栈；
 * undo/redo 能完整回放并重新推演；新操作会清空 future 栈。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from './useProjectStore';
import { mockRequest } from '../utils/mockData';

beforeEach(() => {
  // zustand 是模块级单例，测试间恢复初始数据字段（action 函数由 merge 保留）
  useProjectStore.setState({
    project: mockRequest,
    solveResult: null,
    selectedIds: new Set(),
    isSolving: false,
    past: [],
    future: [],
  });
});

describe('撤销/重做历史栈', () => {
  it('初始状态不可撤销也不可重做', () => {
    const state = useProjectStore.getState();
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
  });

  it('addContainer 进入历史栈，undo 回放，redo 恢复', () => {
    const store = useProjectStore.getState();

    store.addContainer();
    let state = useProjectStore.getState();
    expect(state.project.containers).toHaveLength(2);
    expect(state.past).toHaveLength(1);
    expect(state.future).toHaveLength(0);
    expect(state.isSolving).toBe(false); // solve 已同步完成
    expect(state.solveResult).not.toBeNull();

    state.undo();
    state = useProjectStore.getState();
    expect(state.project.containers).toHaveLength(1);
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(1);
    expect(state.solveResult).not.toBeNull();

    state.redo();
    state = useProjectStore.getState();
    expect(state.project.containers).toHaveLength(2);
    expect(state.past).toHaveLength(1);
    expect(state.future).toHaveLength(0);
  });

  it('undo 后执行新操作会清空 future 栈（禁止"分叉重做"）', () => {
    const store = useProjectStore.getState();

    store.updateContainerAndReSolve(mockRequest.containers[0].id, { maxPayload: 27000 });
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().future).toHaveLength(1);

    // 新操作必须清空重做栈
    useProjectStore.getState().updateContainerAndReSolve(mockRequest.containers[0].id, {
      maxPayload: 26000,
    });
    const state = useProjectStore.getState();
    expect(state.future).toHaveLength(0);
    expect(state.past).toHaveLength(1);
    expect(state.project.containers[0].maxPayload).toBe(26000);
  });

  it('moveCargoOrder 同样进入历史栈', () => {
    const store = useProjectStore.getState();
    const firstCargoId = store.project.cargoList[0].id;

    store.moveCargoOrder(0, 2);
    let state = useProjectStore.getState();
    expect(state.project.cargoList[2].id).toBe(firstCargoId);
    expect(state.past).toHaveLength(1);

    state.undo();
    state = useProjectStore.getState();
    expect(state.project.cargoList[0].id).toBe(firstCargoId);
  });

  it('历史栈满 50 条后丢弃最旧快照', () => {
    const store = useProjectStore.getState();
    const containerId = store.project.containers[0].id;

    // 连续执行 55 次可撤销操作
    for (let i = 0; i < 55; i++) {
      useProjectStore.getState().updateContainerAndReSolve(containerId, {
        maxPayload: 28000 + i,
      });
    }

    const state = useProjectStore.getState();
    expect(state.past).toHaveLength(50);
    // 55 次操作产生 55 个快照，裁剪后最旧的应是第 6 次操作（i=5）前的状态
    expect(state.past[0].containers[0].maxPayload).toBe(28000 + 4);
  });

  it('空栈时调用 undo/redo 是安全 no-op', () => {
    const before = useProjectStore.getState();

    before.undo();
    before.redo();

    const after = useProjectStore.getState();
    expect(after.past).toHaveLength(0);
    expect(after.future).toHaveLength(0);
    expect(after.project).toBe(before.project);
  });
});
