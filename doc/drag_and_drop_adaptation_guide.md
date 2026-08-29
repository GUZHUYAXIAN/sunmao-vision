# 3D Cargo / Box Drag and Drop Architecture

This document extracts the core logic of 3D item interaction (Drag & Drop, Snapping, Collision) from the legacy `BoxStack` codebase (`legacy_code/源码文件/BoxStack/src/inputSystem.js`) and provides architectural patterns for adapting it into the modern `sunmao-vision` project (which typically utilizes React, React Three Fiber, and Zustand).

## 1. Core Essence of the Legacy Implementation

The legacy system utilized a custom `InputManager` to strictly orchestrate state between user inputs, rendering (Three.js), and physics (Cannon.js). The sequence was as follows:

*   **Selection & Raycasting:** 
    A `THREE.Raycaster` identifies interactions with objects or custom translate/rotate gizmo arrows on `pointerdown`.
*   **Physics State Transition:**
    When selected, an object's physics body (`CANNON.Body`) is switched from `STATIC` to `KINEMATIC`. Its velocity and angular velocity are zeroed out so it can be strictly driven by mouse movement without being affected by gravity.
*   **Calculated Translation (Vector Math):**
    Translation is calculated using a `dragPlane` orthogonal to the camera. The distance moved along the specific `dragNormal` (the axis of the clicked gizmo) is strictly computed.
*   **Grid Snapping:**
    If `Shift` is pressed, the translated position is clamped and rounded to the nearest integer multiples of `VOXEL_SIZE`, considering the bounding box dimensions of the object offset by the overall container limits.
*   **Collision Aversion / Interlocking Check:**
    While dragging, a custom collision check (`hasPhysicsCollision`) acts as a safeguard. If a new translated position results in an overlap with other statics or bodies, the translation is rejected and the object stays at the `lastValidPos`.
*   **Release & History:**
    On `pointerup`, the interaction completes. The new state is finalized and pushed to a history manager for Undo/Redo capability.

## 2. Adaptation Guide for `sunmao-vision` (R3F + Zustand)

In the modern React Three Fiber (R3F) ecosystem, doing imperative raycasting and binding raw DOM events is an anti-pattern. We should leverage the reactive state and R3F's built-in event system (`onPointerDown`, `onPointerMove`, `onPointerUp`).

### 2.1 State Management (Zustand)

Instead of mutating simple variables (`draggingMove`, `lastValidPos`), move this into a Zustand slice for predictability and synchronization between the 3D scene and the Properties Panel.

```typescript
// store/useDragStore.ts
import { create } from 'zustand';
import * as THREE from 'three';

interface DragState {
  selectedId: string | null;
  isDragging: boolean;
  dragAxis: THREE.Vector3 | null; // The constraint axis (e.g., [1,0,0] for X arrow)
  dragPlane: THREE.Plane | null;
  lastValidPos: THREE.Vector3 | null;
  
  setSelected: (id: string | null) => void;
  startDrag: (axis: THREE.Vector3, plane: THREE.Plane, initialPos: THREE.Vector3) => void;
  endDrag: () => void;
}

export const useDragStore = create<DragState>((set) => ({
  selectedId: null,
  isDragging: false,
  dragAxis: null,
  dragPlane: null,
  lastValidPos: null,
  
  setSelected: (id) => set({ selectedId: id }),
  startDrag: (axis, plane, pos) => set({ isDragging: true, dragAxis: axis, dragPlane: plane, lastValidPos: pos.clone() }),
  endDrag: () => set({ isDragging: false, dragAxis: null, dragPlane: null }),
}));
```

### 2.2 R3F Drag Interaction Model

Attach interaction events directly to your 3D meshes (or custom Gizmos) inside your R3F components. Use `@react-three/drei`'s `PivotControls` or `TransformControls` if possible, but for strict axis-constrained snapping (as in the legacy system), build custom pointer events:

```tsx
import { useThree, ThreeEvent } from '@react-three/fiber';
import { useDragStore } from '@/store/useDragStore';

const CargoNode = ({ id, initialPosition, size }) => {
  const { camera } = useThree();
  const { selectedId, isDragging, dragPlane, dragAxis, startDrag, endDrag } = useDragStore();
  const isSelected = selectedId === id;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    useDragStore.getState().setSelected(id);
    
    // Set up dragging plane normal to camera
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, e.object.position);
    startDrag(new THREE.Vector3(1, 0, 0), plane, e.object.position); // Example: X axis drag
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging || !isSelected) return;
    e.stopPropagation();
    
    // 1. Raycast to dragPlane using e.ray
    // 2. Calculate delta along dragAxis
    // 3. Apply Snapping (Math.round) & Bounds logic here
    // 4. Collision check: if (!checkCollision(candidatePos)) e.object.position.copy(candidatePos)
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    endDrag();
    // Dispatch final position to main data store and history queue
  };

  return (
    <mesh 
      onPointerDown={handlePointerDown} 
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerOut={handlePointerUp}
      position={initialPosition}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial color={isSelected ? 'orange' : 'gray'} />
    </mesh>
  );
};
```

### 2.3 Physics Handshake (Rapeier / Cannon)
If `sunmao-vision` uses `@react-three/rapier` or `@react-three/cannon`:
1. When `isSelected === true`, transition the RigidBody type from `"dynamic"` or `"fixed"` to `"kinematicPosition"`.
2. Update the `api.position.set(...)` directly inside the `useFrame` or `handlePointerMove`.
3. Once `endDrag()` runs, set it back to `"dynamic"` or `"fixed"` depending on the cargo configuration.

### 2.4 Checklist for Seamless Integration
- [ ] Ensure Raycaster checks only happen against an invisible collision lattice or specifically tagged meshes to save computation.
- [ ] Migrate the `hasPhysicsCollision` strict-check from the legacy code to utilize Rapier/Cannon's built in intersection queries (`world.intersectionBox(...)`).
- [ ] Make sure drag interactions trigger atomic Zustand action drops so UI properties panels stay strictly in sync during `onPointerUp`.
