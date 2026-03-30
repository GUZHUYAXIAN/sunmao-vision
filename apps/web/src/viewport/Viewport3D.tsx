import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CameraControls } from './CameraControls';
import { useProjectStore } from '../stores/useProjectStore';

type MaterialWithUniforms = THREE.Material & {
  [key: string]: unknown;
  uniforms?: Record<string, { value?: unknown }>;
};

const disposeTextureValue = (value: unknown, disposedTextures: Set<THREE.Texture>) => {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => disposeTextureValue(entry, disposedTextures));
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  const textureCandidate = value as THREE.Texture;
  if (!textureCandidate.isTexture || disposedTextures.has(textureCandidate)) {
    return;
  }

  disposedTextures.add(textureCandidate);
  textureCandidate.dispose();
};

const disposeMaterial = (
  material: THREE.Material,
  disposedMaterials: Set<THREE.Material>,
  disposedTextures: Set<THREE.Texture>
) => {
  if (disposedMaterials.has(material)) {
    return;
  }

  const materialWithUniforms = material as MaterialWithUniforms;

  Object.values(materialWithUniforms).forEach((propertyValue) => {
    disposeTextureValue(propertyValue, disposedTextures);
  });

  if (materialWithUniforms.uniforms) {
    Object.values(materialWithUniforms.uniforms).forEach((uniform: any) => {
      disposeTextureValue(uniform?.value, disposedTextures);
    });
  }

  disposedMaterials.add(material);
  material.dispose();
};

const disposeSceneGraph = (scene: THREE.Scene) => {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();

  disposeTextureValue(scene.background, disposedTextures);
  disposeTextureValue(scene.environment, disposedTextures);

  scene.traverse((object3D: any) => {
    const renderableObject = object3D as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };

    if (renderableObject.geometry && !disposedGeometries.has(renderableObject.geometry)) {
      disposedGeometries.add(renderableObject.geometry);
      renderableObject.geometry.dispose();
    }

    if (!renderableObject.material) {
      return;
    }

    const materials = Array.isArray(renderableObject.material)
      ? renderableObject.material
      : [renderableObject.material];

    materials.forEach((material: any) => disposeMaterial(material, disposedMaterials, disposedTextures));
  });

  scene.clear();
};

export const Viewport3D: React.FC = () => {
  const { project, solveResult, selectedIds } = useProjectStore();
  const containers = project?.containers || [];
  const cargoList = project?.cargoList || [];
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const requestRenderRef = useRef<() => void>(() => undefined);
  const containerGroupRef = useRef<THREE.Group | null>(null);
  const containerMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());

  useEffect(() => {
    const hostElement = containerRef.current;
    if (!hostElement) return;

    // 1. 初始化场景
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#f7f2e8');

    // 2. 初始化相机 (这里以 mm 为物理单位，所以相机位置和视距放大约 1000 倍)
    const camera = new THREE.PerspectiveCamera(
      55,
      hostElement.clientWidth / hostElement.clientHeight,
      10,      // 近裁剪面
      50000    // 远裁剪面: 可视范围达到 50m
    );
    camera.position.set(3000, 2000, 5000);

    // 3. 初始化渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(hostElement.clientWidth, hostElement.clientHeight, false);
    hostElement.appendChild(renderer.domElement);

    // 4. 初始化基础光影
    const ambientLight = new THREE.AmbientLight(0xf6f1e7, 1.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight('#fff7ef', 2.6);
    keyLight.position.set(4000, 6000, 8000);
    // 若之后需要阴影，可以启用 keyLight.castShadow
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#d5ecff', 1.1);
    rimLight.position.set(-5000, 3000, -4000);
    scene.add(rimLight);

    // 5. 初始化网格地板和坐标轴
    // 假设常见的长集装箱最长12米(12000mm)左右，因此参考网格铺设 20 米大小。
    const gridSize = 20000;
    const gridDivisions = 40; 
    const grid = new THREE.GridHelper(gridSize, gridDivisions, '#cb8f33', '#d8c5ae');
    scene.add(grid);

    const axesHelper = new THREE.AxesHelper(2500); 
    scene.add(axesHelper);

    const containerGroup = new THREE.Group();
    containerGroup.name = 'containers-group';
    scene.add(containerGroup);
    containerGroupRef.current = containerGroup;

    // 6. 初始化相机控制类 (包含各类交互操作)
    const controls = new CameraControls(camera, renderer.domElement, scene);

    // 7. 按需渲染：只在交互、阻尼衰减或尺寸变化时申请一帧
    let animationFrameId: number | null = null;
    let isDisposed = false;

    const renderFrame = () => {
      animationFrameId = null;
      if (isDisposed) {
        return;
      }

      const stillChanging = controls.update();
      renderer.render(scene, camera);

      if (stillChanging) {
        requestRender();
      }
    };

    const requestRender = () => {
      if (isDisposed || animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    requestRenderRef.current = requestRender;
    controls.orbControls.addEventListener('change', requestRender);
    requestRender();

    // 8. 处理窗口 Resize
    const handleResize = () => {
      if (isDisposed || !containerRef.current) return;

      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight, false);
      requestRender();
    };
    window.addEventListener('resize', handleResize);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !containerGroupRef.current || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      mouse.x = (x / rect.width) * 2 - 1;
      mouse.y = -(y / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(containerGroupRef.current.children, true);
      
      let clickedCargoId: string | null = null;
      for (const intersect of intersects) {
        let obj: THREE.Object3D | null = intersect.object;
        while (obj) {
          if (obj.userData?.isCargo) {
            clickedCargoId = obj.userData.cargoId;
            break;
          }
          obj = obj.parent;
        }
        if (clickedCargoId) break;
      }

      const { setSelection } = useProjectStore.getState();
      if (clickedCargoId) {
        // Option to handle Ctrl/Shift click could be added here, currently just single select
        setSelection(new Set([clickedCargoId]));
      } else {
        setSelection(new Set());
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // 组件卸载清理
    return () => {
      isDisposed = true;
      requestRenderRef.current = () => undefined;
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      controls.orbControls.removeEventListener('change', requestRender);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      controls.dispose();
      disposeSceneGraph(scene);
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      sceneRef.current = null;
      containerGroupRef.current = null;
      containerMeshesRef.current.clear();
      if (hostElement.contains(renderer.domElement)) {
        hostElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 暴露对外的生命周期，用于挂载与解析传入的 Container 并在 Scene 中渲染
  useEffect(() => {
    if (!containerGroupRef.current || !containers) return;

    const group = containerGroupRef.current;
    const currentMap = containerMeshesRef.current as Map<string, THREE.Group | THREE.Mesh>;
    const nextIds = new Set(containers.map((c: any) => c.id));
    
    // 1. 找出需要卸载的旧节点
    const toRemove: THREE.Object3D[] = [];
    currentMap.forEach((obj, id) => {
      if (!nextIds.has(id)) {
        toRemove.push(obj);
        currentMap.delete(id);
      }
    });

    if (toRemove.length > 0) {
      const tempScene = new THREE.Scene();
      toRemove.forEach((obj) => {
        group.remove(obj);
        tempScene.add(obj);
      });
      disposeSceneGraph(tempScene);
    }

    // 2. 挂载或更新新节点
    let hasChanges = toRemove.length > 0;
    let currentX = 0;
    
    containers.forEach((c) => {
      let containerRoot = currentMap.get(c.id) as THREE.Group | undefined;
      
      // We will rebuild the group if solveResult changes (or simply clear and recreate its contents).
      // For simplicity in this mock-up stage: we just re-create things if they are missing or if we want to update.
      // To strictly react to solveResult, we can reconstruct the inner contents every time.
      if (containerRoot) {
        // If containerRoot exists, we can remove it and recreate to easily handle placements
        group.remove(containerRoot);
        const tempScene = new THREE.Scene();
        tempScene.add(containerRoot);
        disposeSceneGraph(tempScene);
      }

      containerRoot = new THREE.Group();
      
      // 集装箱本体边框和外形
      const geometry = new THREE.BoxGeometry(c.length, c.height, c.width);
      const material = new THREE.MeshStandardMaterial({
        color: 0x3399ff,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false, // 避免挡住内部
      });
      const containerMesh = new THREE.Mesh(geometry, material);
      const edgesGeom = new THREE.EdgesGeometry(geometry);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x2266cc, opacity: 0.5, transparent: true });
      const line = new THREE.LineSegments(edgesGeom, lineMat);
      containerMesh.add(line);
      // 将 containerMesh 中心从 (0,0,0) 偏移到 (l/2, h/2, w/2) 以便其角对齐于 containerRoot 的 (0,0,0)
      containerMesh.position.set(c.length / 2, c.height / 2, c.width / 2);
      
      containerRoot.add(containerMesh);

      // 如果有求解结果，在此集装箱坐标系下摆放货物
      if (solveResult?.success) {
        solveResult.placements.forEach((placement) => {
          if (placement.containerId !== c.id) return;
          const cargo = cargoList[placement.cargoIndex];
          if (!cargo) return;

          // box dimensions
          const [l, w, h] = [cargo.dimensions.length, cargo.dimensions.width, cargo.dimensions.height];
          
          const cargoGeo = new THREE.BoxGeometry(l, h, w);
          // 将 BoxGeometry 中心对齐到AABB的最小角: 即 +length/2, +height/2, +width/2
          cargoGeo.translate(l / 2, h / 2, w / 2);

          const cargoMat = new THREE.MeshStandardMaterial({
            color: cargo.color,
            transparent: false,
            roughness: 0.6,
            metalness: 0.1,
          });
          
          const cargoId = `cargo_${placement.cargoIndex}_${placement.instanceIndex}`;
          const isSelected = selectedIds.has(cargoId);
          if (isSelected) {
            cargoMat.emissive.setHex(0x555555);
            cargoMat.opacity = 1.0;
            cargoMat.transparent = false;
          } else if (selectedIds.size > 0) {
            cargoMat.opacity = 0.4;
            cargoMat.transparent = true;
          }
          
          const cargoMesh = new THREE.Mesh(cargoGeo, cargoMat);
          cargoMesh.userData = { isCargo: true, cargoId };
          
          // 给货物加上黑色边线方便分辨
          const cargoEdges = new THREE.EdgesGeometry(cargoGeo);
          const cargoLine = new THREE.LineSegments(cargoEdges, new THREE.LineBasicMaterial({ color: isSelected ? 0xffffff : 0x000000 }));
          cargoMesh.add(cargoLine);

          // 应用姿态: 旋转
          const [rx, ry, rz] = placement.rotation;
          cargoMesh.rotation.set(
            THREE.MathUtils.degToRad(rx),
            THREE.MathUtils.degToRad(ry),
            THREE.MathUtils.degToRad(rz)
          );
          
          // 应用位置: AABB 最小角坐标
          const [px, py, pz] = placement.position;
          // Note: our local space maps Y to height. The position [x,y,z] from solver might be [l,w,h] or [x,y,z] where Z is height in real world?
          // If the solver assumes Z is UP, we might need to swap Y and Z here.
          // In standard solver config: x=length, y=width, z=height? Or X=length, Y=height, Z=width?
          // Let's assume the solver uses (X=length, Y=height, Z=width) for simplicity, or we check the order.
          cargoMesh.position.set(px, py, pz);

          containerRoot!.add(cargoMesh);
        });
      }

      group.add(containerRoot);
      currentMap.set(c.id, containerRoot as any);
      hasChanges = true;
      
      // 更新该集装箱根坐标位置，相邻排开，增加1000mm间距
      containerRoot.position.set(currentX, 0, 0);
      currentX += c.length + 1000;
    });

    if (hasChanges) {
      requestRenderRef.current();
    }
  }, [containers, cargoList, solveResult, selectedIds]);

  return (
    <div 
      ref={containerRef} 
      className="viewport-3d-container"
    />
  );
};
