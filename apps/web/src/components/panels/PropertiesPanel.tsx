import React from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import './PropertiesPanel.css';

export const PropertiesPanel: React.FC = () => {
  const { project, selectedIds } = useProjectStore();

  if (!project) return <div className="properties-panel p-4">没有加载项目</div>;

  // 假设当前只能单选
  const selectedId = Array.from(selectedIds)[0];

  let selectedItemTitle = '无选中内容';
  let properties: Record<string, string | number> = {};

  if (!selectedId) {
    selectedItemTitle = '项目属性';
    const totalCargoCount = project.cargoList.reduce((acc, c) => acc + c.quantity, 0);
    properties = {
      '货物品类数': project.cargoList.length,
      '货物总件数': totalCargoCount,
      '集装箱数': project.containers.length,
      '允许旋转': project.constraints.allowRotation ? '是' : '否',
      '重心稳定性检查': project.constraints.gravityCheck ? '是' : '否'
    };
  } else if (selectedId.startsWith('template_')) {
    const templateId = selectedId.replace('template_', '');
    const cargo = project.cargoList.find(c => c.id === templateId);
    if (cargo) {
      selectedItemTitle = `货物模板: ${cargo.displayName}`;
      properties = {
        '重量 (kg)': cargo.weight,
        '长度 (mm)': cargo.dimensions.length,
        '高度 (mm)': cargo.dimensions.height,
        '宽度 (mm)': cargo.dimensions.width,
        '颜色': cargo.color,
      };
      if (cargo.category) properties['类别'] = cargo.category;
      if (cargo.material) properties['材质'] = cargo.material;
    }
  } else if (selectedId.startsWith('cargo_')) {
    // 选中的是实例
    const parts = selectedId.split('_');
    const cargoIndex = parseInt(parts[1], 10);
    const instanceIndex = parseInt(parts[2], 10);
    const cargo = project.cargoList[cargoIndex];
    if (cargo) {
      selectedItemTitle = `货物实例: ${cargo.displayName} #${instanceIndex + 1}`;
      properties = {
        '实例 ID': selectedId,
        '所属模板': cargo.displayName,
        '重量 (kg)': cargo.weight,
        '尺寸 L×H×W': `${cargo.dimensions.length}×${cargo.dimensions.height}×${cargo.dimensions.width}`,
      };
    }
  } else if (selectedId.startsWith('container_')) {
    const container = project.containers.find(c => c.id === selectedId);
    if (container) {
      selectedItemTitle = `集装箱: ${container.name}`;
      properties = {
        '内部长度 (mm)': container.length,
        '内部高度 (mm)': container.height,
        '内部宽度 (mm)': container.width,
        '最大载重 (kg)': container.maxPayload,
        '皮重 (kg)': container.tareWeight,
      };
    }
  }

  return (
    <div className="properties-panel">
      <div className="properties-header">属性面板 (Properties)</div>
      <div className="properties-body">
        <h3 className="properties-title">{selectedItemTitle}</h3>
        {Object.keys(properties).length > 0 ? (
          <table className="properties-table">
            <tbody>
              {Object.entries(properties).map(([key, value]) => (
                <tr key={key}>
                  <td className="prop-key">{key}</td>
                  <td className="prop-value">
                    {key === '颜色' ? (
                      <div className="color-preview">
                        <span className="color-box" style={{ '--color-value': value as string } as React.CSSProperties}></span>
                        {value}
                      </div>
                    ) : (
                      value
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="prop-empty">没有相关属性数据</div>
        )}
      </div>
    </div>
  );
};
