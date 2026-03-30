/**
 * @sunmao/web — 榫卯视界前端应用入口
 *
 * 3D 视口模块已就位：
 *   - Viewport3D — Three.js 场景、渲染器、灯光、按需渲染
 *   - CameraControls — 轨道控制、滚轮缩放、平移、旋转中心重置
 *
 * TODO: M4 里程碑中实现完整 UI Shell（AppShell 五区布局）
 * TODO: M4 里程碑中实现 TreePanel 双向联动
 */

export { Viewport3D } from "./viewport/Viewport3D";
export type { Viewport3DProps } from "./viewport/Viewport3D";
