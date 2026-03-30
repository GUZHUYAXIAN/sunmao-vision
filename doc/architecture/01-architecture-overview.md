# 榫卯视界 (Sunmao Vision) — 架构总览

> **文档版本**: v1.0
> **最后更新**: 2026-03-30
> **状态**: 设计完成，待评审

---

## 1. 项目定位

**榫卯视界** 是一个集装箱三维可视化自动堆叠系统，核心理念为"像榫卯结构一样充分利用每一寸空间"。

### 1.1 核心能力

| 能力          | 描述                                       |
| ------------- | ------------------------------------------ |
| PDF → 3D 模型 | 通过外部 API 将工程图纸转换为 OBJ 三维模型 |
| 尺寸标定      | 人工校准模型与实际图纸的尺寸比例关系       |
| 自动堆叠求解  | 基于模型真实尺寸进行空间最优堆叠计算       |
| 3D 可视化交互 | 在浏览器中实现堆叠结果的三维预览与操作     |
| 扎带固定方案  | 同步生成货物固定策略                       |
| 装箱清单导出  | 生成包含重量、数量等明细的 Excel 报表      |

### 1.2 产品路线

```text
Web 端应用（当前目标）
    → 桌面软件封装
    → 移动端 APP
    → 嵌入式平板（施工现场）
```

---

## 2. 架构模式：Monorepo + 计算渲染分离

### 2.1 设计哲学

借鉴用户熟悉的有限元分析软件（ANSYS / Abaqus）的架构理念：

| 有限元领域              | 本项目对应                          |
| ----------------------- | ----------------------------------- |
| 求解器（Solver）        | `packages/solver` — 纯计算引擎      |
| 前处理器 + 后处理器     | `apps/web` — React 3D 前端          |
| 数据文件（.inp / .odb） | `packages/contracts` — 统一数据契约 |

### 2.2 目录结构

```text
sunmao-vision/
├── doc/                          # 项目文档
│   ├── architecture/             # 架构设计文档
│   └── guides/                   # 开发指南
├── legacy_code/                  # 旧代码存档（不参与构建）
├── packages/
│   ├── contracts/                # 📜 统一数据契约
│   │   ├── src/
│   │   │   ├── schemas/          # Zod Schema 定义
│   │   │   │   ├── model.ts      # ModelAsset, ScaleRecord
│   │   │   │   ├── cargo.ts      # CargoTemplate, CargoInstance
│   │   │   │   ├── container.ts  # Container
│   │   │   │   ├── lashing.ts    # LashingPreset
│   │   │   │   ├── solver.ts     # SolveRequest, SolveResult
│   │   │   │   └── project.ts    # Project
│   │   │   ├── index.ts          # 统一导出
│   │   │   └── types.ts          # TypeScript 类型导出
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── solver/                   # 🧮 堆叠求解器
│       ├── src/
│       │   ├── algorithms/
│       │   │   ├── packer.ts     # 核心堆叠算法
│       │   │   ├── collision.ts  # 碰撞检测
│       │   │   ├── gravity.ts    # 重心稳定性检测
│       │   │   └── lashing.ts    # 扎带方案生成
│       │   ├── helpers/
│       │   │   ├── freeSpace.ts  # 自由空间管理
│       │   │   └── geometry.ts   # 几何计算工具
│       │   ├── index.ts          # solve() 入口
│       │   └── types.ts          # solver 内部类型
│       ├── __tests__/            # 单元测试
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   └── web/                      # 🖥️ React 前端应用
│       ├── public/
│       │   └── models/           # OBJ 模型文件存放
│       ├── src/
│       │   ├── components/       # React 组件
│       │   │   ├── layout/       # 布局组件
│       │   │   │   └── AppShell.tsx
│       │   │   ├── viewport/     # 3D 视口
│       │   │   │   ├── Viewport3D.tsx
│       │   │   │   ├── CameraControls.tsx
│       │   │   │   └── ObjectPicker.tsx
│       │   │   ├── panels/       # 控制面板
│       │   │   │   ├── TreePanel.tsx
│       │   │   │   ├── PropertiesPanel.tsx
│       │   │   │   ├── ContainerManager.tsx
│       │   │   │   └── LashingPanel.tsx
│       │   │   ├── widgets/      # 小部件
│       │   │   │   ├── WeightRuler.tsx
│       │   │   │   ├── WeightToggle.tsx
│       │   │   │   └── ActionBar.tsx
│       │   │   ├── workflow/     # 步骤引导
│       │   │   │   ├── WorkflowStepper.tsx
│       │   │   │   ├── ImportStep.tsx
│       │   │   │   ├── CalibrateStep.tsx
│       │   │   │   ├── ConfigureStep.tsx
│       │   │   │   └── SolveStep.tsx
│       │   │   └── dialogs/      # 弹窗
│       │   │       └── ExportDialog.tsx
│       │   ├── hooks/            # 自定义 Hooks
│       │   │   ├── useScene.ts   # Three.js 场景管理
│       │   │   ├── useSelection.ts # 选中逻辑
│       │   │   └── useWeightScale.ts # 重量色阶
│       │   ├── dal/              # 数据访问层
│       │   │   ├── interface.ts  # DAL 接口定义
│       │   │   ├── localJsonDal.ts  # 本地 JSON 实现
│       │   │   └── apiDal.ts     # 远程 API 实现(预留)
│       │   ├── stores/           # 状态管理
│       │   │   └── projectStore.ts
│       │   ├── utils/            # 工具函数
│       │   │   ├── objLoader.ts  # OBJ 加载器
│       │   │   ├── lod.ts        # LOD 策略
│       │   │   └── exportExcel.ts # Excel 导出
│       │   ├── styles/           # 全局样式
│       │   │   └── index.css
│       │   ├── App.tsx           # 应用主入口
│       │   └── main.tsx          # Vite 入口
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── workflow_rules.md             # GitHub 协作规范
├── package.json                  # 根级 (workspace 配置)
├── tsconfig.base.json            # 共享 TS 配置
└── README.md
```

### 2.3 模块职责与依赖关系

```text
                        ┌─────────────────┐
                        │ packages/       │
                        │ contracts       │
                        │ (Zod Schemas)   │
                        └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    │ 依赖       │            │ 依赖
                    ▼            │            ▼
            ┌──────────────┐    │    ┌──────────────┐
            │ packages/    │    │    │ apps/web     │
            │ solver       │    │    │ (React 前端)  │
            │ (纯计算)      │◄───┘    │              │
            └──────┬───────┘         └──────┬───────┘
                   │                        │
                   │    调用 solve()         │
                   ◄────────────────────────┘
```

**关键原则**：

| 规则               | 说明                                                       |
| ------------------ | ---------------------------------------------------------- |
| `contracts` 零依赖 | 除了 `zod` 以外不依赖任何库                                |
| `solver` 不依赖 UI | 不能 import React / Three.js 等任何前端库                  |
| `web` 可依赖所有   | 同时使用 `contracts` 和 `solver`                           |
| 单向数据流         | 前端构造 `SolveRequest` → 调用 solver → 渲染 `SolveResult` |

---

## 3. 数据访问层 (DAL)

### 3.1 设计意图

解耦数据的存取方式，使业务逻辑不关心数据来自本地文件还是远程 API。

```text
业务逻辑层
    │
    ▼
┌──────────────────────────┐
│   DAL 接口 (interface)    │ ← 统一的读写方法签名
├──────────┬───────────────┤
│ 本地 JSON │  远程 API     │ ← 可切换的具体实现
│ (当前)    │  (未来)       │
└──────────┴───────────────┘
```

### 3.2 接口定义

```typescript
interface DataAccessLayer {
  // 项目
  loadProject(id: string): Promise<Project>;
  saveProject(project: Project): Promise<void>;

  // 模型资产
  listModels(): Promise<ModelAsset[]>;
  importModel(file: File): Promise<ModelAsset>;

  // 缩放标定
  getScaleRecord(modelId: string): Promise<ScaleRecord | null>;
  saveScaleRecord(record: ScaleRecord): Promise<void>;

  // 导出
  exportManifest(result: SolveResult): Promise<Blob>; // Excel 文件
}
```

### 3.3 当前实现

**本地 JSON 模式**：所有数据以 `.json` 文件形式存放在项目目录中，模型文件（`.obj`）存放在 `public/models/` 目录。浏览器通过 `fetch()` 读取本地文件，通过文件下载保存结果。

**未来切换**：只需实现一个 `ApiDal` 类，替换注入到应用中即可，业务逻辑代码不需要任何修改。

---

## 4. 技术选型

| 领域        | 技术              | 版本   | 理由                        |
| ----------- | ----------------- | ------ | --------------------------- |
| 前端框架    | React             | 19.x   | 组件化、生态丰富、社区活跃  |
| 类型系统    | TypeScript        | 5.x    | 类型安全、契约验证          |
| 构建工具    | Vite              | 6.x    | 极速热更新、原生 ESM        |
| 3D 引擎     | Three.js          | 0.170+ | Web 3D 标准、OBJ 加载支持   |
| 数据校验    | Zod               | 3.x    | 运行时 + 编译时双重类型安全 |
| 3D 模型格式 | OBJ               | —      | 保留完整细节、无损转换      |
| 测试框架    | Vitest            | 3.x    | 与 Vite 深度集成            |
| 包管理      | pnpm workspace    | 10.x   | Monorepo 原生支持           |
| Excel 导出  | SheetJS (xlsx)    | 0.20+  | 纯前端 Excel 生成           |
| 代码规范    | ESLint + Prettier | —      | 统一代码风格                |

---

## 5. 性能策略

### 5.1 LOD（细节层次）策略

```text
镜头距模型距离       渲染精度
─────────────────────────────
  < 5m (近景)   →   高精度（原始 OBJ 全量面片）
  5~20m (中景)  →   中精度（简化 50% 面片）
  > 20m (远景)  →   低精度（仅包围盒 + 颜色块）

触发方式：相机 zoom 变化时自动切换
```

### 5.2 渲染优化

| 策略       | 说明                                                    |
| ---------- | ------------------------------------------------------- |
| 实例化渲染 | 同类型货物使用 `InstancedMesh`，一次 draw call 渲染多个 |
| 视锥裁剪   | Three.js 自动跳过镜头外的物体                           |
| 按需渲染   | 场景无变化时不重绘（`invalidateFrameloop`）             |
| Web Worker | 求解器在 Worker 线程运行，不阻塞 UI                     |
