import React, { useState } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { solve } from '@sunmao/solver';
import { buildExportManifest } from '../../utils/exportManifest';
import { exportManifestToExcel } from '../../utils/excelExport';
import './ActionBar.css';

export const ActionBar: React.FC = () => {
  const { project, setSolveResult } = useProjectStore();
  const solveResult = useProjectStore((state) => state.solveResult);
  // 单独订阅栈深度：只有栈变化时才触发按钮灰显重渲染
  const pastDepth = useProjectStore((state) => state.past.length);
  const futureDepth = useProjectStore((state) => state.future.length);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const [isSolving, setIsSolving] = useState(false);

  const handleSolve = () => {
    if (!project) return;
    setIsSolving(true);

    // 简单的异步包装以免阻塞 UI
    setTimeout(() => {
      try {
        const result = solve(project);
        setSolveResult(result);
        if (!result.success) {
          console.warn('求解未完全成功:', result.warnings);
        }
      } catch (err) {
        console.error('求解失败', err);
      } finally {
        setIsSolving(false);
      }
    }, 50);
  };

  /** 导出 Excel：构建契约清单 → 生成工作簿下载 */
  const handleExportExcel = () => {
    if (!project || !solveResult) return;
    try {
      const manifest = buildExportManifest(project, solveResult);
      exportManifestToExcel(manifest, project, solveResult);
    } catch (err) {
      console.error('导出 Excel 失败', err);
    }
  };

  return (
    <div className="action-bar">
      <div className="title">📦 孙尚香 - 装箱视觉化</div>
      <div className="actions">
        <button
          className="btn"
          onClick={undo}
          disabled={pastDepth === 0}
          title="撤销 (Ctrl+Z)"
        >
          ↩ 撤销
        </button>
        <button
          className="btn"
          onClick={redo}
          disabled={futureDepth === 0}
          title="重做 (Ctrl+Y / Ctrl+Shift+Z)"
        >
          ↪ 重做
        </button>
        <button
          className="btn"
          onClick={handleExportExcel}
          disabled={!project || !solveResult}
          title="导出 Excel 装箱清单（需先运行求解器）"
        >
          📊 导出 Excel
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSolve}
          disabled={isSolving || !project}
        >
          {isSolving ? '计算中...' : '▶ 运行求解器'}
        </button>
      </div>
    </div>
  );
};
