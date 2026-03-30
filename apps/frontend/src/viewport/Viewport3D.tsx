import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CameraControls } from './CameraControls';
import type { Container } from '@sunmao/contracts';

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

export interface Viewport3DProps {
  // 预留一个能接收标准 Zod 契约数据的入口函数
  containers?: Container[];
}

export const Viewport3D: React.FC<Viewport3DProps> = ({ containers = [] }) => {
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

    // 组件卸载清理
    return () => {
      isDisposed = true;
      requestRenderRef.current = () => undefined;
      window.removeEventListener('resize', handleResize);
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
    const currentMap = containerMeshesRef.current;
    const nextIds = new Set(containers.map((c: any) => c.id));
    
    // 1. 找出需要卸载的旧节点
    const toRemove: THREE.Mesh[] = [];
    currentMap.forEach((mesh: THREE.Mesh, id: string) => {
      if (!nextIds.has(id)) {
        toRemove.push(mesh);
        currentMap.delete(id);
      }
    });

    if (toRemove.length > 0) {
      // 巧用独立 Scene，复用全局的安全 disposeSceneGraph 防止显存泄漏
      const tempScene = new THREE.Scene();
      toRemove.forEach((mesh) => {
        group.remove(mesh);
        tempScene.add(mesh);
      });
      disposeSceneGraph(tempScene);
    }

    // 2. 挂载或更新新节点
    let hasChanges = toRemove.length > 0;
    
    // 暂时的简单排列：沿 X 轴间距排列
    let currentX = 0;
    
    containers.forEach((c: any) => {
      let mesh = currentMap.get(c.id);
      if (!mesh) {
        // 创建立方体 (根据常见认知：x为长 length，y为高 height，z为宽 width)
        const geometry = new THREE.BoxGeometry(c.length, c.height, c.width);
        const material = new THREE.MeshStandardMaterial({
          color: 0x3399ff,
          transparent: true,
          opacity: 0.25,
          side: THREE.DoubleSide,
        });
        mesh = new THREE.Mesh(geometry, material);

        const edgesGeom = new THREE.EdgesGeometry(geometry);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x2266cc });
        const line = new THREE.LineSegments(edgesGeom, lineMat);
        mesh.add(line);

        group.add(mesh);
        currentMap.set(c.id, mesh);
        hasChanges = true;
      }
      
      // 更新位置，相邻排开，增加1000mm间距
      mesh.position.set(currentX + c.length / 2, c.height / 2, 0);
      currentX += c.length + 1000;
    });

    if (hasChanges) {
      requestRenderRef.current();
    }
  }, [containers]);

  return (
    <div 
      ref={containerRef} 
      className="viewport-3d-container"
      style={{ width: '100%', height: '100%', minHeight: '600px', backgroundColor: '#f7f2e8', overflow: 'hidden' }} 
    />
  );
};
