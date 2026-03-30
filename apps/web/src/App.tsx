import React, { useEffect } from "react";
import { AppShell } from "./components/layout/AppShell";
import { solve } from "@sunmao/solver";
import { useProjectStore } from "./stores/useProjectStore";

export const App: React.FC = () => {
  const { project, setSolveResult } = useProjectStore();

  useEffect(() => {
    // 自动调用求解算法
    try {
      const res = solve(project);
      setSolveResult(res);
      console.log("Solver result automatically generated:", res);
    } catch (e) {
      console.error("Auto solve failed", e);
    }
  }, [project, setSolveResult]);

  return <AppShell />;
};
