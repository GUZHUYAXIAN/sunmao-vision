import { create } from 'zustand';
import type { SolveRequest, SolveResult } from '@sunmao/contracts';
import { mockRequest } from '../utils/mockData';

interface ProjectStore {
  project: SolveRequest;
  solveResult: SolveResult | null;
  selectedIds: Set<string>;
  setSelection: (ids: Set<string>) => void;
  updateProject: (project: SolveRequest) => void;
  setSolveResult: (result: SolveResult | null) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: mockRequest,
  solveResult: null,
  selectedIds: new Set(),
  setSelection: (ids) => set({ selectedIds: ids }),
  updateProject: (project) => set({ project }),
  setSolveResult: (result) => set({ solveResult: result }),
}));
