import React, { useState, useCallback, useRef } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import './TreePanel.css';

// ─── 拖拽数据结构 ──────────────────────────────────────────────────────────────

interface DragState {
  /** 拖拽源货物类型的 cargoIndex（在 cargoList 中的位置） */
  sourceCargoIndex: number;
  /** 拖拽的实例索引，undefined 表示整个货物类型节点 */
  sourceInstanceIndex?: number;
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

/**
 * 生成货物实例的 ID，必须与 Viewport3D 中的 userData.cargoId 保持一致。
 */
const buildInstanceId = (cargoIndex: number, instanceIndex: number): string =>
  `cargo_${cargoIndex}_${instanceIndex}`;

/**
 * 生成货物类型节点的 ID（用于 TreePanel 内部折叠状态）
 */
const buildTemplateNodeId = (cargoId: string): string => `template_${cargoId}`;

/**
 * 生成集装箱节点的 ID（用于选中状态同步）
 */
const buildContainerId = (containerId: string): string => `container_${containerId}`;

// ─── 子组件：货物实例叶节点 ───────────────────────────────────────────────────

interface LeafNodeProps {
  cargoIndex: number;
  instanceIndex: number;
  displayName: string;
  isSelected: boolean;
  isDragOver: boolean;
  onSelect: (id: string, multiSelect: boolean) => void;
  onDragStart: (cargoIndex: number, instanceIndex: number) => void;
  onDragOver: (e: React.DragEvent, cargoIndex: number, instanceIndex: number) => void;
  onDrop: (targetCargoIndex: number, targetInstanceIndex: number) => void;
  onDragEnd: () => void;
}

const LeafNode: React.FC<LeafNodeProps> = ({
  cargoIndex,
  instanceIndex,
  displayName,
  isSelected,
  isDragOver,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) => {
  const instanceId = buildInstanceId(cargoIndex, instanceIndex);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(instanceId, e.ctrlKey || e.metaKey || e.shiftKey);
    },
    [instanceId, onSelect]
  );

  return (
    <div
      className={[
        'tree-item',
        'tree-leaf',
        isSelected ? 'selected' : '',
        isDragOver ? 'drag-over' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable
      onClick={handleClick}
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart(cargoIndex, instanceIndex);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(e, cargoIndex, instanceIndex);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDrop(cargoIndex, instanceIndex);
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        onDragEnd();
      }}
    >
      <span className="leaf-indent" />
      <span className="leaf-icon" aria-hidden="true">
        📦
      </span>
      <span className="cargo-name">
        {displayName} #{instanceIndex + 1}
      </span>
      {isSelected && <span className="selected-badge" aria-label="已选中" />}
    </div>
  );
};

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export const TreePanel: React.FC = () => {
  const {
    project,
    solveResult,
    selectedIds,
    setSelection,
    moveCargoOrder,
    addContainer,
    deleteContainer,
  } = useProjectStore();

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // 用于 Shift 多选的锚点
  const lastClickedIdRef = useRef<string | null>(null);

  // ── 展开/折叠 ───────────────────────────────────────────────────────────────

  const toggleExpand = useCallback((nodeKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  }, []);

  // ── 选中逻辑 ────────────────────────────────────────────────────────────────

  /**
   * 点击集装箱节点：选中该集装箱（使用 container_ 前缀 ID）
   */
  const handleSelectContainer = useCallback(
    (containerId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelection(new Set([buildContainerId(containerId)]));
    },
    [setSelection]
  );

  /**
   * 点击货物类型节点：选中该类型下所有在 3D 视口放置的实例。
   * 如果没有 solveResult（尚未求解），则全部按数量选中。
   */
  const handleSelectCargoType = useCallback(
    (cargoIndex: number, quantity: number, e: React.MouseEvent) => {
      e.stopPropagation();
      const instanceIds = new Set<string>();

      if (solveResult?.success) {
        // 只选中实际摆放的实例
        solveResult.placements.forEach((placement) => {
          if (placement.cargoIndex === cargoIndex) {
            instanceIds.add(
              buildInstanceId(cargoIndex, placement.instanceIndex)
            );
          }
        });
      } else {
        // 未求解时按 quantity 预选
        for (let i = 0; i < quantity; i++) {
          instanceIds.add(buildInstanceId(cargoIndex, i));
        }
      }
      setSelection(instanceIds);
    },
    [solveResult, setSelection]
  );

  /**
   * 点击叶子节点：支持 Ctrl/Cmd 追加选中，Shift 范围选中，单击单选。
   */
  const handleSelectInstance = useCallback(
    (instanceId: string, multiSelect: boolean) => {
      setSelection((prevIds: Set<string>) => {
        if (!multiSelect) {
          // 单选
          lastClickedIdRef.current = instanceId;
          return new Set([instanceId]);
        }
        // Ctrl/Cmd 多选：toggle
        const next = new Set(prevIds);
        if (next.has(instanceId)) {
          next.delete(instanceId);
        } else {
          next.add(instanceId);
          lastClickedIdRef.current = instanceId;
        }
        return next;
      });
    },
    [setSelection]
  );

  // ── 拖拽逻辑 ────────────────────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (cargoIndex: number, instanceIndex?: number) => {
      setDragState({ sourceCargoIndex: cargoIndex, sourceInstanceIndex: instanceIndex });
    },
    []
  );

  const handleDragOver = useCallback(
    (_e: React.DragEvent, cargoIndex: number, instanceIndex?: number) => {
      const key =
        instanceIndex !== undefined
          ? buildInstanceId(cargoIndex, instanceIndex)
          : `type_${cargoIndex}`;
      setDragOverKey(key);
    },
    []
  );

  const handleDrop = useCallback(
    (targetCargoIndex: number) => {
      if (!dragState) return;
      const { sourceCargoIndex } = dragState;
      if (sourceCargoIndex === targetCargoIndex) {
        setDragState(null);
        setDragOverKey(null);
        return;
      }
      // 调用 store 动作重排货物类型顺序
      moveCargoOrder(sourceCargoIndex, targetCargoIndex);
      setDragState(null);
      setDragOverKey(null);
    },
    [dragState, moveCargoOrder]
  );

  const handleDragEnd = useCallback(() => {
    setDragState(null);
    setDragOverKey(null);
  }, []);

  // ── 集装箱删除 ─────────────────────────────────────────────────────────────

  const handleDeleteContainer = useCallback(
    (containerId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (project.containers.length <= 1) {
        alert('至少保留一个集装箱！');
        return;
      }
      deleteContainer(containerId);
    },
    [project.containers.length, deleteContainer]
  );

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

  if (!project) {
    return (
      <div className="tree-panel tree-panel--empty">
        <span className="tree-empty-hint">暂无项目数据</span>
      </div>
    );
  }

  // 构建一张 cargoIndex → placedInstanceCount 映射，用于展示已放置数量
  const placedCountByIndex = new Map<number, number>();
  if (solveResult?.success) {
    solveResult.placements.forEach((p) => {
      placedCountByIndex.set(
        p.cargoIndex,
        (placedCountByIndex.get(p.cargoIndex) ?? 0) + 1
      );
    });
  }

  return (
    <div className="tree-panel">
      {/* ─── 集装箱区域 ─────────────────────────────────────────────────── */}
      <div className="tree-section">
        <div className="tree-section-header">
          <span className="tree-section-icon" aria-hidden="true">🚢</span>
          <span className="tree-section-title">集装箱</span>
          <span className="tree-section-count">{project.containers.length} 个</span>
          <button
            className="tree-action-btn tree-action-btn--add"
            title="添加集装箱"
            aria-label="添加集装箱"
            onClick={(e) => {
              e.stopPropagation();
              addContainer();
            }}
          >
            +
          </button>
        </div>

        <div className="tree-body tree-body--containers">
          {project.containers.map((container) => {
            const containerSelId = buildContainerId(container.id);
            const isSelected = selectedIds.has(containerSelId);

            return (
              <div
                key={container.id}
                className={[
                  'tree-item',
                  'tree-container-item',
                  isSelected ? 'selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={(e) => handleSelectContainer(container.id, e)}
                title={`点击选中：${container.name}`}
              >
                <span className="container-icon" aria-hidden="true">📦</span>
                <span className="container-name" title={container.name}>
                  {container.name}
                </span>
                <span className="container-size-badge">
                  {container.length}×{container.width}×{container.height}
                </span>
                {isSelected && <span className="selected-badge" aria-label="已选中" />}
                <button
                  className="tree-action-btn tree-action-btn--delete"
                  title="删除此集装箱"
                  aria-label={`删除 ${container.name}`}
                  onClick={(e) => handleDeleteContainer(container.id, e)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 货物区域 ────────────────────────────────────────────────────── */}
      <div className="tree-section">
        <div className="tree-section-header">
          <span className="tree-section-icon" aria-hidden="true">📁</span>
          <span className="tree-section-title">物品清单</span>
          <span className="tree-section-count">{project.cargoList.length} 类</span>
        </div>

        {/* 树体 */}
        <div
          className="tree-body"
          onDragLeave={() => setDragOverKey(null)}
        >
          {project.cargoList.map((cargo, cargoIndex) => {
            const templateNodeId = buildTemplateNodeId(cargo.id);
            const isExpanded = expandedKeys.has(templateNodeId);
            const placedCount = placedCountByIndex.get(cargoIndex);
            const isDragOverType = dragOverKey === `type_${cargoIndex}`;
            const isDraggingThis =
              dragState?.sourceCargoIndex === cargoIndex &&
              dragState.sourceInstanceIndex === undefined;

            // 判断该类型下是否有已选中的实例
            const typeHasSelection = solveResult?.success
              ? solveResult.placements.some(
                  (p) =>
                    p.cargoIndex === cargoIndex &&
                    selectedIds.has(buildInstanceId(cargoIndex, p.instanceIndex))
                )
              : Array.from({ length: cargo.quantity }).some((_, i) =>
                  selectedIds.has(buildInstanceId(cargoIndex, i))
                );

            return (
              <div
                key={templateNodeId}
                className={[
                  'tree-node',
                  isDraggingThis ? 'dragging' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {/* 货物类型行（组节点） */}
                <div
                  className={[
                    'tree-item',
                    'tree-group',
                    typeHasSelection ? 'has-selected-child' : '',
                    isDragOverType ? 'drag-over' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  draggable
                  onClick={(e) =>
                    handleSelectCargoType(cargoIndex, cargo.quantity, e)
                  }
                  onDragStart={(e) => {
                    handleDragStart(cargoIndex);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    handleDragOver(e, cargoIndex);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(cargoIndex);
                  }}
                  onDragEnd={handleDragEnd}
                >
                  {/* 展开/折叠箭头 */}
                  <button
                    className={`expand-btn ${isExpanded ? 'expand-btn--open' : ''}`}
                    aria-label={isExpanded ? '折叠' : '展开'}
                    onClick={(e) => toggleExpand(templateNodeId, e)}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      className="expand-chevron"
                    >
                      <polyline
                        points={isExpanded ? '1,3 5,7 9,3' : '3,1 7,5 3,9'}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {/* 颜色色块 */}
                  <span
                    className="cargo-color-box"
                    style={{ '--cargo-color': cargo.color } as React.CSSProperties}
                    aria-hidden="true"
                  />

                  {/* 货物名称 */}
                  <span className="cargo-name" title={cargo.displayName}>
                    {cargo.displayName}
                  </span>

                  {/* 数量徽章 */}
                  <span className="cargo-qty-badge" aria-label={`共 ${cargo.quantity} 件`}>
                    {placedCount !== undefined
                      ? `${placedCount}/${cargo.quantity}`
                      : `×${cargo.quantity}`}
                  </span>

                  {/* 拖拽把手 */}
                  <span className="drag-handle" aria-hidden="true" title="拖拽排序">
                    ⠿
                  </span>
                </div>

                {/* 分隔线（拖拽放置指示器） */}
                {isDragOverType && dragState && (
                  <div className="drop-indicator" aria-hidden="true" />
                )}

                {/* 子节点：货物实例列表 */}
                {isExpanded && (
                  <div className="tree-children" role="group" aria-label={cargo.displayName + ' 实例列表'}>
                    {solveResult?.success ? (
                      // 有求解结果时，只展示已放置的实例，并显示位置信息
                      solveResult.placements
                        .filter((p) => p.cargoIndex === cargoIndex)
                        .map((placement) => {
                          const instanceId = buildInstanceId(
                            cargoIndex,
                            placement.instanceIndex
                          );
                          const isDragOverLeaf = dragOverKey === instanceId;
                          return (
                            <LeafNode
                              key={instanceId}
                              cargoIndex={cargoIndex}
                              instanceIndex={placement.instanceIndex}
                              displayName={cargo.displayName}
                              isSelected={selectedIds.has(instanceId)}
                              isDragOver={isDragOverLeaf}
                              onSelect={handleSelectInstance}
                              onDragStart={handleDragStart}
                              onDragOver={handleDragOver}
                              onDrop={handleDrop}
                              onDragEnd={handleDragEnd}
                            />
                          );
                        })
                    ) : (
                      // 未求解时，按 quantity 展示预占位节点
                      Array.from({ length: cargo.quantity }).map((_, i) => {
                        const instanceId = buildInstanceId(cargoIndex, i);
                        const isDragOverLeaf = dragOverKey === instanceId;
                        return (
                          <LeafNode
                            key={instanceId}
                            cargoIndex={cargoIndex}
                            instanceIndex={i}
                            displayName={cargo.displayName}
                            isSelected={selectedIds.has(instanceId)}
                            isDragOver={isDragOverLeaf}
                            onSelect={handleSelectInstance}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onDragEnd={handleDragEnd}
                          />
                        );
                      })
                    )}

                    {/* 空内容兜底 */}
                    {solveResult?.success &&
                      !solveResult.placements.some(
                        (p) => p.cargoIndex === cargoIndex
                      ) && (
                        <div className="tree-leaf-empty">
                          <span>⚠ 该货物未被放置</span>
                        </div>
                      )}
                  </div>
                )}
              </div>
            );
          })}

          {/* 整棵树空状态 */}
          {project.cargoList.length === 0 && (
            <div className="tree-empty-hint">暂无货物，请先添加</div>
          )}
        </div>
      </div>

      {/* 底部状态栏 */}
      <div className="tree-footer">
        {selectedIds.size > 0 ? (
          <>
            <span className="tree-footer__selected-count">
              已选 {selectedIds.size} 件
            </span>
            <button
              className="tree-footer__clear-btn"
              onClick={() => setSelection(new Set())}
            >
              清除选择
            </button>
          </>
        ) : (
          <span className="tree-footer__hint">点击条目以在 3D 视图中高亮</span>
        )}
      </div>
    </div>
  );
};
