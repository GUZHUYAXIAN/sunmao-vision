import React, { useState } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import './TreePanel.css';

export const TreePanel: React.FC = () => {
  const { project, selectedIds, setSelection } = useProjectStore();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpand = (cargoId: string) => {
    const newExpanded = new Set(expandedKeys);
    if (newExpanded.has(cargoId)) {
      newExpanded.delete(cargoId);
    } else {
      newExpanded.add(cargoId);
    }
    setExpandedKeys(newExpanded);
  };

  const handleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // 简单实现单选，按需求可扩展多选
    const newSelection = new Set<string>();
    newSelection.add(id);
    setSelection(newSelection);
  };

  if (!project) return <div className="tree-panel p-4">没有加载项目</div>;

  return (
    <div className="tree-panel">
      <div className="tree-header">物品树 (Cargo List)</div>
      <div className="tree-body">
        {project.cargoList.map((cargo, index) => {
          const isExpanded = expandedKeys.has(cargo.id);
          const cargoNodeId = `template_${cargo.id}`;
          
          return (
            <div key={cargoNodeId} className="tree-node">
              <div 
                className={`tree-item ${selectedIds.has(cargoNodeId) ? 'selected' : ''}`}
                onClick={(e) => handleSelect(cargoNodeId, e)}
              >
                <button 
                  className="expand-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(cargo.id);
                  }}
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
                <span className="cargo-color-box" style={{ '--cargo-color': cargo.color } as React.CSSProperties}></span>
                <span className="cargo-name">{cargo.displayName}</span>
                <span className="cargo-qty">x {cargo.quantity}</span>
              </div>
              
              {isExpanded && (
                <div className="tree-children">
                  {Array.from({ length: cargo.quantity }).map((_, i) => {
                    const instanceId = `cargo_${index}_${i}`;
                    const isSelected = selectedIds.has(instanceId);
                    return (
                      <div 
                        key={instanceId} 
                        className={`tree-item tree-leaf ${isSelected ? 'selected' : ''}`}
                        onClick={(e) => handleSelect(instanceId, e)}
                      >
                        <span className="leaf-icon">📄</span>
                        <span className="cargo-name">{cargo.displayName} #{i + 1}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
