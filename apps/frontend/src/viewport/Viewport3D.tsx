import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CameraControls } from './CameraControls';
import type { Container } from '@sunmao/contracts';

export interface Viewport3DProps {
  // 预留一个能接收标准 Zod 契约数据的入口函数
  containers?: Container[];
}

export const Viewport3D: React.FC<Viewport3DProps> = ({ containers = [] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. 初始化场景
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#f7f2e8');

    // 2. 初始化相机 (这里以 mm 为物理单位，所以相机位置和视距放大约 1000 倍)
    const camera = new THREE.PerspectiveCamera(
      55,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      10,      // 近裁剪面
      50000    // 远裁剪面: 可视范围达到 50m
    );
    camera.position.set(3000, 2000, 5000);

    // 3. 初始化渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);

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

    // 6. 初始化相机控制类 (包含各类交互操作)
    const controls = new CameraControls(camera, renderer.domElement, scene);

    // 7. 动画循环渲染
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 8. 处理窗口 Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // 组件卸载清理
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
      // 清空场景
      scene.clear();
      if (containerRef.current && containerRef.current.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 暴露对外的生命周期，用于后续解析传入的 Container 并在 Scene 中渲染
  useEffect(() => {
    if (!sceneRef.current || !containers || containers.length === 0) return;
    
    // 该部分预留，当接收到包含容器的数据后，在此处理3D对象的挂载渲染
    console.log('Received Zod Contract Data - Containers:', containers);

    // TODO: 实现根据 containers 生成 3D 对象并添加到 sceneRef.current 的逻辑
    // 记得在每次重新传入时清空前一次生成的 mesh

  }, [containers]);

  return (
    <div 
      ref={containerRef} 
      className="viewport-3d-container"
      style={{ width: '100%', height: '100%', minHeight: '600px', backgroundColor: '#f7f2e8', overflow: 'hidden' }} 
    />
  );
};
