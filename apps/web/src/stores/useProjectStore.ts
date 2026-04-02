import { create } from 'zustand';
import { solve } from '@sunmao/solver';
import type { SolveRequest, SolveResult } from '@sunmao/contracts';
import type { CargoTemplate, Container } from '@sunmao/contracts';
import { mockRequest } from '../utils/mockData';

// ─── UUID 生成工具（无需额外依赖） ──────────────────────────────────────────
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const randomValue = (Math.random() * 16) | 0;
    const result = character === 'x' ? randomValue : (randomValue & 0x3) | 0x8;
    return result.toString(16);
  });
}

type SelectionUpdater = (prevIds: Set<string>) => Set<string>;

/** 允许对货物模板进行局部更新的字段集合 */
export interface CargoUpdatePatch {
  weight?: number;
  dimensions?: Partial<{
    length: number;
    width: number;
    height: number;
  }>;
}

/** 允许对集装箱进行局部更新的字段集合 */
export interface ContainerUpdatePatch {
  length?: number;
  width?: number;
  height?: number;
  maxPayload?: number;
}

interface ProjectStore {
  project: SolveRequest;
  solveResult: SolveResult | null;
  selectedIds: Set<string>;
  /** 解算是否正在进行中（防止重复触发） */
  isSolving: boolean;
  /** 设置/更新选中集合。支持直接传入 Set，或传入 updater 函数（类似 React setState） */
  setSelection: (ids: Set<string> | SelectionUpdater) => void;
  updateProject: (project: SolveRequest) => void;
  setSolveResult: (result: SolveResult | null) => void;
  /**
   * 将 cargoList 中 `fromIndex` 位置的货物移动到 `toIndex` 位置。
   * 同时同步清空选中状态（避免 ID 错位）。
   */
  moveCargoOrder: (fromIndex: number, toIndex: number) => void;

  /**
   * 【实例解耦/Fork 机制】核心 Action：
   *
   * 当用户修改某个 cargo 实例（cargo_X_Y）的物理属性时：
   *   1. 深拷贝原 CargoTemplate，生成新模板（名称加 "-定制" 后缀），赋予新 UUID。
   *   2. 将新模板的 quantity 设为 1（代表这一个被定制的实例）。
   *   3. 原模板的 quantity 减 1（该实例已从原模板中"分裂"出去）。
   *      若原模板剩余 quantity === 0，则从 cargoList 中移除该模板。
   *   4. 将新模板（携带 patch 中的新属性值）追加到 cargoList 末尾。
   *   5. 使用最新的完整 project 调用 solve() 重新推演。
   *   6. 写入新的 SolveResult，触发 Viewport3D 重建 3D 场景。
   *
   * 绝对不会污染原有的公共模板！
   */
  forkInstanceAndReSolve: (cargoIndex: number, patch: CargoUpdatePatch) => void;

  /**
   * 核心联动 Action：原子更新货物模板属性 + 立即重新推演 + 写入新结果。
   * 用于从 template_ 节点选中后直接修改整个模板（影响所有实例）。
   */
  updateCargoAndReSolve: (cargoId: string, patch: CargoUpdatePatch) => void;

  /**
   * 添加一个新的默认集装箱到项目中，并触发重新推演。
   */
  addContainer: () => void;

  /**
   * 删除指定 ID 的集装箱，并触发重新推演（如果仍有至少一个集装箱）。
   */
  deleteContainer: (containerId: string) => void;

  /**
   * 核心联动 Action：原子更新集装箱属性 + 立即重新推演 + 写入新结果。
   */
  updateContainerAndReSolve: (containerId: string, patch: ContainerUpdatePatch) => void;
}

// ─── 内部工具：执行 solve 并安全写回 ──────────────────────────────────────────

function runSolveAndCommit(
  updatedProject: SolveRequest,
  set: (partial: Partial<ProjectStore>) => void
): void {
  try {
    const newSolveResult = solve(updatedProject);
    set({ solveResult: newSolveResult, isSolving: false });
  } catch (solveError) {
    console.error('[useProjectStore] solve() 失败', solveError);
    set({ isSolving: false });
  }
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: mockRequest,
  solveResult: null,
  selectedIds: new Set(),
  isSolving: false,

  setSelection: (ids) => {
    if (typeof ids === 'function') {
      const updater = ids as SelectionUpdater;
      set((state) => ({ selectedIds: updater(state.selectedIds) }));
    } else {
      set({ selectedIds: ids });
    }
  },

  updateProject: (project) => set({ project }),

  setSolveResult: (result) => set({ solveResult: result }),

  moveCargoOrder: (fromIndex: number, toIndex: number) => {
    const { project } = get();
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= project.cargoList.length ||
      toIndex >= project.cargoList.length
    ) {
      return;
    }

    const newCargoList = [...project.cargoList];
    const [movedItem] = newCargoList.splice(fromIndex, 1);
    newCargoList.splice(toIndex, 0, movedItem);

    set({
      project: { ...project, cargoList: newCargoList },
      // 清空选中，避免 cargoIndex 映射错位
      selectedIds: new Set(),
    });
  },

  // ── 缺陷 1 修复：Fork 机制 ─────────────────────────────────────────────────
  forkInstanceAndReSolve: (cargoIndex: number, patch: CargoUpdatePatch) => {
    const { project, isSolving } = get();
    if (isSolving) return;

    const originalTemplate = project.cargoList[cargoIndex];
    if (!originalTemplate) return;

    // ① 深拷贝原模板，生成定制化新模板
    const forkedTemplate: CargoTemplate = {
      ...originalTemplate,
      id: generateUUID(),
      displayName: `${originalTemplate.displayName}-定制`,
      quantity: 1,
      // 应用 patch 中的修改
      ...(patch.weight !== undefined ? { weight: patch.weight } : {}),
      dimensions: patch.dimensions
        ? { ...originalTemplate.dimensions, ...patch.dimensions }
        : { ...originalTemplate.dimensions },
    };

    // ② 原模板 quantity - 1（该实例已从原模板中分裂出去）
    const updatedOriginal: CargoTemplate = {
      ...originalTemplate,
      quantity: originalTemplate.quantity - 1,
    };

    // ③ 构建新的 cargoList：
    //    - 若原模板剩余 quantity > 0，保留（更新后的）原模板
    //    - 若原模板剩余 quantity === 0，从列表中移除
    //    - 追加新的定制化模板
    const newCargoList: CargoTemplate[] = [
      ...project.cargoList.map((cargo, index) => {
        if (index !== cargoIndex) return cargo;
        return updatedOriginal;
      }).filter((cargo) => cargo.quantity > 0),
      forkedTemplate,
    ];

    const updatedProject: typeof project = {
      ...project,
      cargoList: newCargoList,
    };

    // ④ 先更新 project + 标记推演中，再触发 solve
    set({ project: updatedProject, isSolving: true, selectedIds: new Set() });
    runSolveAndCommit(updatedProject, set);
  },

  // ── 整体模板更新（影响所有同类实例） ─────────────────────────────────────
  updateCargoAndReSolve: (cargoId: string, patch: CargoUpdatePatch) => {
    const { project, isSolving } = get();
    if (isSolving) return;

    const updatedCargoList = project.cargoList.map((cargo) => {
      if (cargo.id !== cargoId) return cargo;
      return {
        ...cargo,
        ...(patch.weight !== undefined ? { weight: patch.weight } : {}),
        dimensions: patch.dimensions
          ? { ...cargo.dimensions, ...patch.dimensions }
          : cargo.dimensions,
      };
    });

    const updatedProject: typeof project = {
      ...project,
      cargoList: updatedCargoList,
    };

    set({ project: updatedProject, isSolving: true });
    runSolveAndCommit(updatedProject, set);
  },

  // ── 缺陷 2 修复：集装箱管理 Action ────────────────────────────────────────
  addContainer: () => {
    const { project } = get();
    const newContainer: Container = {
      id: generateUUID(),
      name: `新集装箱 ${project.containers.length + 1}`,
      length: 5898,
      width: 2352,
      height: 2393,
      maxPayload: 28000,
      tareWeight: 2200,
    };

    const updatedProject: typeof project = {
      ...project,
      containers: [...project.containers, newContainer],
    };

    set({ project: updatedProject, isSolving: true });
    runSolveAndCommit(updatedProject, set);
  },

  deleteContainer: (containerId: string) => {
    const { project, isSolving } = get();
    if (isSolving) return;

    const updatedContainers = project.containers.filter((container) => container.id !== containerId);
    // 至少保留一个集装箱（solver 要求 min(1)）
    if (updatedContainers.length === 0) {
      console.warn('[useProjectStore] deleteContainer: 无法删除最后一个集装箱');
      return;
    }

    const updatedProject: typeof project = {
      ...project,
      containers: updatedContainers,
    };

    // 清空选中（防止访问已删除集装箱的 ID）
    set({ project: updatedProject, isSolving: true, selectedIds: new Set() });
    runSolveAndCommit(updatedProject, set);
  },

  updateContainerAndReSolve: (containerId: string, patch: ContainerUpdatePatch) => {
    const { project, isSolving } = get();
    if (isSolving) return;

    const updatedContainers = project.containers.map((container) => {
      if (container.id !== containerId) return container;
      return {
        ...container,
        ...(patch.length !== undefined ? { length: patch.length } : {}),
        ...(patch.width !== undefined ? { width: patch.width } : {}),
        ...(patch.height !== undefined ? { height: patch.height } : {}),
        ...(patch.maxPayload !== undefined ? { maxPayload: patch.maxPayload } : {}),
      };
    });

    const updatedProject: typeof project = {
      ...project,
      containers: updatedContainers,
    };

    set({ project: updatedProject, isSolving: true });
    runSolveAndCommit(updatedProject, set);
  },
}));
