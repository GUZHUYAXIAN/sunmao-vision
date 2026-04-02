import React, { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import type { CargoUpdatePatch, ContainerUpdatePatch } from '../../stores/useProjectStore';
import './PropertiesPanel.css';

// ────────────────────────────────────────────────────────────
// 货物编辑表单组件（双击进入模式后展示）
// ────────────────────────────────────────────────────────────

interface CargoEditFormState {
  weight: string;
  length: string;
  width: string;
  height: string;
}

interface CargoEditFormProps {
  initialValues: { weight: number; length: number; width: number; height: number };
  /** 点击保存时回调，传入经过校验后的最终数值 */
  onSave: (patch: CargoUpdatePatch) => void;
  /** 点击取消时回调 */
  onCancel: () => void;
}

const CargoEditForm: React.FC<CargoEditFormProps> = ({ initialValues, onSave, onCancel }) => {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [formState, setFormState] = useState<CargoEditFormState>({
    weight: String(initialValues.weight),
    length: String(initialValues.length),
    width: String(initialValues.width),
    height: String(initialValues.height),
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    firstInputRef.current?.select();
  }, []);

  const handleFieldChange = (field: keyof CargoEditFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, [field]: event.target.value }));
    setValidationError(null);
  };

  const handleSave = () => {
    const parsed = {
      weight: parseFloat(formState.weight),
      length: parseFloat(formState.length),
      width: parseFloat(formState.width),
      height: parseFloat(formState.height),
    };

    const invalidField = (Object.entries(parsed) as [string, number][]).find(
      ([, value]) => isNaN(value) || value <= 0,
    );

    if (invalidField) {
      setValidationError(`「${invalidField[0]}」必须是正数`);
      return;
    }

    onSave({
      weight: parsed.weight,
      dimensions: {
        length: parsed.length,
        width: parsed.width,
        height: parsed.height,
      },
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') handleSave();
    if (event.key === 'Escape') onCancel();
  };

  const editableFields: { field: keyof CargoEditFormState; label: string }[] = [
    { field: 'weight', label: '重量 (kg)' },
    { field: 'length', label: '长度 (mm)' },
    { field: 'width', label: '宽度 (mm)' },
    { field: 'height', label: '高度 (mm)' },
  ];

  return (
    <div className="cargo-edit-form" onKeyDown={handleKeyDown}>
      <div className="edit-form-title">✏️ 编辑货物属性</div>

      {editableFields.map(({ field, label }, index) => (
        <div key={field} className="edit-form-row">
          <label className="edit-form-label" htmlFor={`edit-field-${field}`}>
            {label}
          </label>
          <input
            id={`edit-field-${field}`}
            ref={index === 0 ? firstInputRef : undefined}
            className="edit-form-input"
            type="number"
            min={0.001}
            step="any"
            value={formState[field]}
            onChange={handleFieldChange(field)}
            aria-label={label}
          />
        </div>
      ))}

      {validationError && (
        <div className="edit-form-error" role="alert">
          ⚠️ {validationError}
        </div>
      )}

      <div className="edit-form-actions">
        <button
          type="button"
          className="btn-save"
          onClick={handleSave}
          aria-label="保存并重新推演"
        >
          ✅ 保存
        </button>
        <button
          type="button"
          className="btn-cancel"
          onClick={onCancel}
          aria-label="取消编辑"
        >
          ✕ 取消
        </button>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// 集装箱编辑表单组件
// ────────────────────────────────────────────────────────────

interface ContainerEditFormState {
  length: string;
  width: string;
  height: string;
  maxPayload: string;
}

interface ContainerEditFormProps {
  initialValues: { length: number; width: number; height: number; maxPayload: number };
  onSave: (patch: ContainerUpdatePatch) => void;
  onCancel: () => void;
}

const ContainerEditForm: React.FC<ContainerEditFormProps> = ({ initialValues, onSave, onCancel }) => {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [formState, setFormState] = useState<ContainerEditFormState>({
    length: String(initialValues.length),
    width: String(initialValues.width),
    height: String(initialValues.height),
    maxPayload: String(initialValues.maxPayload),
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    firstInputRef.current?.select();
  }, []);

  const handleFieldChange = (field: keyof ContainerEditFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, [field]: event.target.value }));
    setValidationError(null);
  };

  const handleSave = () => {
    const parsed = {
      length: parseFloat(formState.length),
      width: parseFloat(formState.width),
      height: parseFloat(formState.height),
      maxPayload: parseFloat(formState.maxPayload),
    };

    const invalidField = (Object.entries(parsed) as [string, number][]).find(
      ([, value]) => isNaN(value) || value <= 0,
    );

    if (invalidField) {
      setValidationError(`「${invalidField[0]}」必须是正数`);
      return;
    }

    onSave(parsed);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') handleSave();
    if (event.key === 'Escape') onCancel();
  };

  const editableFields: { field: keyof ContainerEditFormState; label: string }[] = [
    { field: 'length', label: '内部长度 (mm)' },
    { field: 'width', label: '内部宽度 (mm)' },
    { field: 'height', label: '内部高度 (mm)' },
    { field: 'maxPayload', label: '最大载重 (kg)' },
  ];

  return (
    <div className="cargo-edit-form" onKeyDown={handleKeyDown}>
      <div className="edit-form-title">✏️ 编辑集装箱规格</div>

      {editableFields.map(({ field, label }, index) => (
        <div key={field} className="edit-form-row">
          <label className="edit-form-label" htmlFor={`container-edit-${field}`}>
            {label}
          </label>
          <input
            id={`container-edit-${field}`}
            ref={index === 0 ? firstInputRef : undefined}
            className="edit-form-input"
            type="number"
            min={0.001}
            step="any"
            value={formState[field]}
            onChange={handleFieldChange(field)}
            aria-label={label}
          />
        </div>
      ))}

      {validationError && (
        <div className="edit-form-error" role="alert">
          ⚠️ {validationError}
        </div>
      )}

      <div className="edit-form-actions">
        <button
          type="button"
          className="btn-save"
          onClick={handleSave}
          aria-label="保存集装箱规格并重新推演"
        >
          ✅ 保存并重算
        </button>
        <button
          type="button"
          className="btn-cancel"
          onClick={onCancel}
          aria-label="取消编辑"
        >
          ✕ 取消
        </button>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// 主面板
// ────────────────────────────────────────────────────────────

export const PropertiesPanel: React.FC = () => {
  const {
    project,
    selectedIds,
    isSolving,
    updateCargoAndReSolve,
    forkInstanceAndReSolve,
    updateContainerAndReSolve,
  } = useProjectStore();
  const [isEditing, setIsEditing] = useState(false);
  const [flashSuccess, setFlashSuccess] = useState(false);

  // 每次 isSolving 从 true → false，闪烁成功效果
  const prevIsSolvingRef = useRef(false);
  useEffect(() => {
    if (prevIsSolvingRef.current && !isSolving) {
      setFlashSuccess(true);
      const timer = setTimeout(() => setFlashSuccess(false), 1200);
      return () => clearTimeout(timer);
    }
    prevIsSolvingRef.current = isSolving;
  }, [isSolving]);

  // 切换选中项时退出编辑模式
  useEffect(() => {
    setIsEditing(false);
  }, [selectedIds]);

  if (!project) return <div className="properties-panel p-4">没有加载项目</div>;

  const selectedId = Array.from(selectedIds)[0];

  // ── 无选中：显示项目摘要 ──
  if (!selectedId) {
    const totalCargoCount = project.cargoList.reduce((acc, cargo) => acc + cargo.quantity, 0);
    const summaryRows = [
      { label: '货物品类数', value: project.cargoList.length },
      { label: '货物总件数', value: totalCargoCount },
      { label: '集装箱数', value: project.containers.length },
      { label: '允许旋转', value: project.constraints.allowRotation ? '是' : '否' },
      { label: '重心检查', value: project.constraints.gravityCheck ? '是' : '否' },
    ];
    return (
      <div className="properties-panel">
        <div className="properties-header">属性面板 (Properties)</div>
        <div className="properties-body">
          <h3 className="properties-title">项目属性</h3>
          <table className="properties-table">
            <tbody>
              {summaryRows.map(({ label, value }) => (
                <tr key={label}>
                  <td className="prop-key">{label}</td>
                  <td className="prop-value">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── 选中集装箱 → 支持编辑 ──
  if (selectedId.startsWith('container_')) {
    const containerId = selectedId.replace('container_', '');
    const container = project.containers.find((c) => c.id === containerId);
    if (!container) return null;

    const handleContainerSave = (patch: ContainerUpdatePatch) => {
      setIsEditing(false);
      updateContainerAndReSolve(containerId, patch);
    };

    return (
      <div className={`properties-panel${flashSuccess ? ' flash-success' : ''}`}>
        <div className="properties-header">属性面板 (Properties)</div>
        <div className="properties-body">
          <h3 className="properties-title">
            🚢 集装箱: {container.name}
          </h3>

          {isSolving && <div className="solving-badge">⚡ 重新推演中…</div>}

          {isEditing ? (
            // ── 编辑模式 ──
            <ContainerEditForm
              initialValues={{
                length: container.length,
                width: container.width,
                height: container.height,
                maxPayload: container.maxPayload,
              }}
              onSave={handleContainerSave}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            // ── 只读模式：双击进入编辑 ──
            <>
              <div className="edit-hint">
                💡 双击数值行可修改集装箱规格，保存后自动重新推演所有货物
              </div>
              <table className="properties-table">
                <tbody>
                  {[
                    { label: '内部长度 (mm)', value: container.length },
                    { label: '内部宽度 (mm)', value: container.width },
                    { label: '内部高度 (mm)', value: container.height },
                    { label: '最大载重 (kg)', value: container.maxPayload },
                    { label: '皮重 (kg)', value: container.tareWeight },
                  ].map(({ label, value }, index) => (
                    <tr
                      key={label}
                      // 皮重不可编辑（最后一项），其余行双击进入编辑
                      className={index < 4 ? 'editable-row' : ''}
                      onDoubleClick={index < 4 ? () => setIsEditing(true) : undefined}
                      title={index < 4 ? '双击进入编辑模式' : undefined}
                    >
                      <td className="prop-key">
                        {label}
                        {index < 4 && <span className="edit-icon" aria-label="可编辑">✏️</span>}
                      </td>
                      <td className="prop-value">
                        <span className={index < 4 ? 'editable-value' : ''}>{value}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── 选中了货物模板 → 支持编辑（影响所有同类实例） ──
  if (selectedId.startsWith('template_')) {
    const templateId = selectedId.replace('template_', '');
    const cargo = project.cargoList.find((c) => c.id === templateId);
    if (!cargo) return null;

    const readonlyRows = [
      { label: '颜色', value: cargo.color, isColor: true },
      ...(cargo.category ? [{ label: '类别', value: cargo.category, isColor: false }] : []),
      ...(cargo.material ? [{ label: '材质', value: cargo.material, isColor: false }] : []),
    ];

    const handleTemplateSave = (patch: CargoUpdatePatch) => {
      setIsEditing(false);
      updateCargoAndReSolve(templateId, patch);
    };

    return (
      <div className={`properties-panel${flashSuccess ? ' flash-success' : ''}`}>
        <div className="properties-header">属性面板 (Properties)</div>
        <div className="properties-body">
          <h3 className="properties-title">货物模板: {cargo.displayName}</h3>

          <div className="edit-scope-badge edit-scope-badge--template">
            🔗 修改将同步影响所有 {cargo.quantity} 件同类货物
          </div>

          {isSolving && <div className="solving-badge">⚡ 重新推演中…</div>}

          {isEditing ? (
            // ── 编辑模式：展示完整表单 ──
            <CargoEditForm
              initialValues={{
                weight: cargo.weight,
                length: cargo.dimensions.length,
                width: cargo.dimensions.width,
                height: cargo.dimensions.height,
              }}
              onSave={handleTemplateSave}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            // ── 只读模式：双击任意可编辑行进入编辑 ──
            <>
              <div className="edit-hint">
                💡 双击数值行可进入编辑模式，保存后自动重新推演
              </div>
              <table className="properties-table">
                <tbody>
                  {/* 可编辑行 */}
                  {[
                    { label: '重量 (kg)', value: cargo.weight },
                    { label: '长度 (mm)', value: cargo.dimensions.length },
                    { label: '高度 (mm)', value: cargo.dimensions.height },
                    { label: '宽度 (mm)', value: cargo.dimensions.width },
                  ].map(({ label, value }) => (
                    <tr
                      key={label}
                      className="editable-row"
                      onDoubleClick={() => setIsEditing(true)}
                      title="双击进入编辑模式"
                    >
                      <td className="prop-key">
                        {label}
                        <span className="edit-icon" aria-label="可编辑">✏️</span>
                      </td>
                      <td className="prop-value">
                        <span className="editable-value">{value}</span>
                      </td>
                    </tr>
                  ))}

                  {/* 只读行 */}
                  {readonlyRows.map(({ label, value, isColor }) => (
                    <tr key={label}>
                      <td className="prop-key">{label}</td>
                      <td className="prop-value">
                        {isColor ? (
                          <div className="color-preview">
                            <span
                              className="color-box"
                              style={{ '--color-value': value } as React.CSSProperties}
                            />
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
            </>
          )}
        </div>
      </div>
    );
  }

  // ── 选中货物实例 → 展示实例属性，编辑时触发 Fork 机制！ ──
  if (selectedId.startsWith('cargo_')) {
    const parts = selectedId.split('_');
    const cargoIndex = parseInt(parts[1], 10);
    const instanceIndex = parseInt(parts[2], 10);
    const cargo = project.cargoList[cargoIndex];
    if (!cargo) return null;

    const readonlyRows = [
      { label: '颜色', value: cargo.color, isColor: true },
      ...(cargo.category ? [{ label: '类别', value: cargo.category, isColor: false }] : []),
      ...(cargo.material ? [{ label: '材质', value: cargo.material, isColor: false }] : []),
    ];

    // ⚠️ 关键修复：实例编辑触发 Fork，不污染原模板！
    const handleInstanceSave = (patch: CargoUpdatePatch) => {
      setIsEditing(false);
      forkInstanceAndReSolve(cargoIndex, patch);
    };

    return (
      <div className={`properties-panel${flashSuccess ? ' flash-success' : ''}`}>
        <div className="properties-header">属性面板 (Properties)</div>
        <div className="properties-body">
          <h3 className="properties-title">
            {cargo.displayName}
            <span className="instance-badge">#{instanceIndex + 1}</span>
          </h3>

          <div className="edit-scope-badge edit-scope-badge--instance">
            ✂️ 修改将从原模板分裂出【独立定制版本】，不影响其他件
          </div>

          {isSolving && <div className="solving-badge">⚡ 重新推演中…</div>}

          {isEditing ? (
            // ── 编辑模式：展示完整表单，保存时触发 Fork ──
            <CargoEditForm
              initialValues={{
                weight: cargo.weight,
                length: cargo.dimensions.length,
                width: cargo.dimensions.width,
                height: cargo.dimensions.height,
              }}
              onSave={handleInstanceSave}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            // ── 只读模式：双击任意可编辑行进入编辑 ──
            <>
              <div className="edit-hint">
                💡 双击数值行进入编辑。保存后此货物将独立定制，其他同类件不受影响
              </div>
              <table className="properties-table">
                <tbody>
                  {/* 可编辑行 */}
                  {[
                    { label: '重量 (kg)', value: cargo.weight },
                    { label: '长度 (mm)', value: cargo.dimensions.length },
                    { label: '高度 (mm)', value: cargo.dimensions.height },
                    { label: '宽度 (mm)', value: cargo.dimensions.width },
                  ].map(({ label, value }) => (
                    <tr
                      key={label}
                      className="editable-row"
                      onDoubleClick={() => setIsEditing(true)}
                      title="双击进入编辑模式"
                    >
                      <td className="prop-key">
                        {label}
                        <span className="edit-icon" aria-label="可编辑">✏️</span>
                      </td>
                      <td className="prop-value">
                        <span className="editable-value">{value}</span>
                      </td>
                    </tr>
                  ))}

                  {/* 只读行 */}
                  {readonlyRows.map(({ label, value, isColor }) => (
                    <tr key={label}>
                      <td className="prop-key">{label}</td>
                      <td className="prop-value">
                        {isColor ? (
                          <div className="color-preview">
                            <span
                              className="color-box"
                              style={{ '--color-value': value } as React.CSSProperties}
                            />
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
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="properties-panel">
      <div className="properties-header">属性面板 (Properties)</div>
      <div className="properties-body">
        <div className="prop-empty">无选中内容</div>
      </div>
    </div>
  );
};
