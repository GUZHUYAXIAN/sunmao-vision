import React, { useEffect } from 'react';
import { Viewport3D } from '../../viewport/Viewport3D';
import { TreePanel } from '../panels/TreePanel';
import { PropertiesPanel } from '../panels/PropertiesPanel';
import { ActionBar } from '../widgets/ActionBar';
import { WeightRuler } from '../widgets/WeightRuler';
import { useProjectStore } from '../../stores/useProjectStore';

/** 焦点落在可编辑控件上时不拦截快捷键，避免破坏输入体验 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export const AppShell: React.FC = () => {
  // 全局撤销/重做快捷键：Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y（macOS 兼容 Cmd 键）
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        useProjectStore.getState().undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        useProjectStore.getState().redo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app-shell">
      <div className="shell-topbar">
        <ActionBar />
      </div>
      <div className="shell-leftpanel">
        <TreePanel />
      </div>
      <div className="shell-center">
        <Viewport3D />
      </div>
      <div className="shell-rightpanel">
        <PropertiesPanel />
      </div>
      <div className="shell-statusbar">
        <WeightRuler />
      </div>
    </div>
  );
};
