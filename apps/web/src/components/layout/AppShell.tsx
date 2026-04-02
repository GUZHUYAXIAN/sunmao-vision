import React from 'react';
import { Viewport3D } from '../../viewport/Viewport3D';
import { TreePanel } from '../panels/TreePanel';
import { PropertiesPanel } from '../panels/PropertiesPanel';
import { ActionBar } from '../widgets/ActionBar';
import { WeightRuler } from '../widgets/WeightRuler';

export const AppShell: React.FC = () => {
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
