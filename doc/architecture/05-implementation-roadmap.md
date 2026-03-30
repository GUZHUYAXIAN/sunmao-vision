# 实施路线图 (Implementation Roadmap)

> **文档版本**: v1.0
> **最后更新**: 2026-03-30
> **状态**: 设计完成，待评审

---

## 1. 阶段总览

将项目实施分为 **6 个里程碑 (Milestone)**，每个里程碑对应一个可独立验证的交付成果。

```text
M0 ──── M1 ──── M2 ──── M3 ──── M4 ──── M5
基建     契约     求解器    3D视口   交互完善  导出&打磨
(1周)   (1周)   (2-3周)  (2-3周)  (2周)    (1-2周)
```

**总预估**: 9~12 周（单人开发节奏，含测试与迭代）

---

## 2. 各里程碑详情

### M0: 基础设施搭建

**目标**: 建立 Monorepo 骨架，确保开发工具链可用。

| 任务 | 说明 | 产出物 |
| --- | --- | --- |
| 初始化 pnpm workspace | 根级 `package.json` + `pnpm-workspace.yaml` | 项目骨架 |
| 创建 `packages/contracts` | 空包骨架 + tsconfig | 空包 |
| 创建 `packages/solver` | 空包骨架 + tsconfig | 空包 |
| 创建 `apps/web` | Vite + React + TypeScript 脚手架 | 可运行的空前端 |
| 配置共享 tsconfig | `tsconfig.base.json` | 统一 TS 配置 |
| 配置 ESLint + Prettier | 统一代码风格 | `.eslintrc` + `.prettierrc` |
| 配置 Vitest | 各包独立测试配置 | 测试框架可用 |
| 验证跨包引用 | contracts ← solver ← web 依赖链 | 跨包 import 可用 |

**验收标准**:

- `pnpm install` 成功
- `pnpm --filter @sunmao/web dev` 可启动空白页面
- `pnpm test` 可运行示例测试

---

### M1: 数据契约实现

**目标**: 将设计文档中定义的所有 Zod Schema 落地为可用的 npm 包。

| 任务 | 说明 | 产出物 |
| --- | --- | --- |
| 实现 model schemas | `ModelAsset` + `ScaleRecord` | `schemas/model.ts` |
| 实现 cargo schemas | `CargoTemplate` + `CargoInstance` | `schemas/cargo.ts` |
| 实现 container schema | `Container` | `schemas/container.ts` |
| 实现 lashing schemas | `LashingPreset` + 内置规格数据 | `schemas/lashing.ts` |
| 实现 solver schemas | `SolveRequest` + `SolveResult` + 子类型 | `schemas/solver.ts` |
| 实现 project schema | `Project` | `schemas/project.ts` |
| 实现 export schema | `ExportManifest` | `schemas/export.ts` |
| 统一导出 | `index.ts` 导出所有 schema 和类型 | 包可用 |
| 编写测试 | 每个 schema 的合法/非法数据校验测试 | 测试通过 |

**验收标准**:

- 所有 schema 测试通过
- 从 `@sunmao/contracts` 可以正确 import 所有类型
- Zod `parse()` 可以正确校验合法和非法数据

---

### M2: 求解器核心

**目标**: 实现堆叠算法核心，输入 `SolveRequest`，输出 `SolveResult`。

| 任务 | 说明 | 产出物 |
| --- | --- | --- |
| 自由空间管理 | 初始空间 = 容器体积，每次放入后切割剩余空间 | `freeSpace.ts` |
| 碰撞检测 | AABB 碰撞检测（轴对齐包围盒） | `collision.ts` |
| 基础堆叠算法 | 贪心策略：按体积降序，逐个放入最优位置 | `packer.ts` |
| 旋转策略 | 尝试 6 种旋转方向，选最优 | `packer.ts` |
| 重力/稳定性 | 检测放置后重心是否在支撑面内 | `gravity.ts` |
| 扎带方案生成 | 根据放置结果生成固定路径 | `lashing.ts` |
| 统计计算 | 利用率、净重、毛重、扎带重量汇总 | `statistics.ts` |
| solve() 入口 | 组合以上模块，提供统一调用接口 | `index.ts` |
| 单元测试 | 每个模块的边界情况测试 | 测试全通过 |
| 集成测试 | 完整的 SolveRequest → SolveResult 流程测试 | 测试全通过 |

**验收标准**:

- `solve(request)` 返回合法的 `SolveResult`
- 碰撞检测无误：不出现重叠放置
- 统计数字（重量、利用率）计算正确
- 测试覆盖率 ≥ 80%

---

### M3: 3D 视口与基础渲染

**目标**: 在浏览器中渲染求解结果的 3D 场景。

| 任务 | 说明 | 产出物 |
| --- | --- | --- |
| Three.js 场景初始化 | 场景、相机、灯光、渲染器 | `Viewport3D.tsx` |
| OBJ 模型加载 | 使用 OBJLoader 加载本地 OBJ 文件 | `objLoader.ts` |
| 相机控制 | 旋转、平移、缩放、V+点击设中心 | `CameraControls.tsx` |
| 集装箱渲染 | 线框模式渲染集装箱边界 | `containerRenderer.ts` |
| 货物渲染 | 根据 Placement 坐标放置模型 | `cargoRenderer.ts` |
| 重量色阶着色 | 根据重量映射颜色到每个货物 | `useWeightScale.ts` |
| LOD 策略 | 远粗近细自动切换 | `lod.ts` |
| 射线检测 | 点击识别物体 | `ObjectPicker.tsx` |
| DAL 本地实现 | 本地 JSON 文件读写 | `localJsonDal.ts` |

**验收标准**:

- 页面可正常渲染 3D 集装箱和货物
- 相机控制流畅（旋转、平移、缩放）
- 点击货物可高亮（其余变半透明）
- 重量色阶正确映射

---

### M4: 交互功能完善

**目标**: 实现全部 7 个交互功能 + 工作台布局。

| 任务 | 说明 | 产出物 |
| --- | --- | --- |
| AppShell 布局 | 左/中/右/上/下五区布局 | `AppShell.tsx` |
| TreePanel | 物品树（折叠/展开/拖拽） | `TreePanel.tsx` |
| 双向联动 | 树 ↔ 3D 选中同步 | `useSelection.ts` |
| 拖拽逻辑 | 树内拖拽 + 3D 拖拽 → 双向同步 | 拖拽系统 |
| 选中逻辑 | Ctrl/Shift/全选 仿 Windows | `useSelection.ts` |
| 高亮效果 | 选中高亮 + 其余降低透明度 | `Viewport3D.tsx` |
| PropertiesPanel | 只读查看(单击) + 编辑(双击) | `PropertiesPanel.tsx` |
| ContainerManager | 集装箱增删改 UI | `ContainerManager.tsx` |
| WeightRuler | 底部色阶条 + 自定义选项 | `WeightRuler.tsx` |
| WeightToggle | 净重/毛重切换 + 悬停显示 | `WeightToggle.tsx` |
| 撤销/重做 | Ctrl+Z / Ctrl+Shift+Z | 撤销栈 |
| WorkflowStepper | 四步设置引导 | `WorkflowStepper.tsx` |

**验收标准**:

- 7 个交互功能全部可用
- 树面板与 3D 视口完全双向联动
- 选中/取消选中的透明度变化正确
- 撤销/重做功能可用

---

### M5: 导出、打磨与优化

**目标**: 完成导出功能、性能优化、UI 美化。

| 任务 | 说明 | 产出物 |
| --- | --- | --- |
| Excel 导出 | 使用 SheetJS 生成装箱清单 | `exportExcel.ts` |
| JSON 导出/导入 | 项目文件的保存和恢复 | DAL 扩展 |
| ExportDialog | 导出选项弹窗 | `ExportDialog.tsx` |
| ActionBar | 顶部操作按钮 | `ActionBar.tsx` |
| 性能优化 | InstancedMesh、按需渲染 | 性能提升 |
| UI 美化 | 暗色主题、动画、过渡效果 | 视觉提升 |
| 响应式布局 | 适配不同屏幕尺寸 | 布局优化 |
| E2E 测试 | 关键用户流程端到端测试 | 测试通过 |

**验收标准**:

- Excel 导出内容完整且格式正确
- 项目可保存/加载
- 页面加载和交互流畅
- UI 美观、专业

---

## 3. 里程碑依赖关系

```text
M0 (基建) ─────┬───► M1 (契约) ───► M2 (求解器) ──┐
               │                                    │
               └───► M3 (3D 视口) ◄─────────────────┘
                           │
                           ▼
                     M4 (交互完善)
                           │
                           ▼
                     M5 (导出&打磨)
```

**关键路径**: M0 → M1 → M2 → M3 → M4 → M5

**可并行的工作**: M2（求解器）和 M3（3D 视口基础）可以在 M1 完成后并行启动。

---

## 4. 架构设计文档索引

| 文档 | 文件名 | 内容 |
| --- | --- | --- |
| 架构总览 | `01-architecture-overview.md` | Monorepo 结构、模块职责、技术选型、性能策略 |
| 数据契约 | `02-data-contracts.md` | 全部 Zod Schema 定义、扎带预设、数据关系图 |
| 前端设计 | `03-frontend-design.md` | 页面布局、7 大交互功能、组件职责、状态管理 |
| 开发规范 | `04-development-standards.md` | 编码标准、文件组织、测试规范、Git 工作流 |
| 实施路线 | `05-implementation-roadmap.md` | 6 个里程碑、任务分解、依赖关系、验收标准 |

所有文档存放于 `doc/architecture/` 目录下。
