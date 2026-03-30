import React, { useState } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { solve } from '@sunmao/solver';
import './ActionBar.css';

export const ActionBar: React.FC = () => {
  const { project, setSolveResult } = useProjectStore();
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

  return (
    <div className="action-bar">
      <div className="title">📦 孙尚香 - 装箱视觉化</div>
      <div className="actions">
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
