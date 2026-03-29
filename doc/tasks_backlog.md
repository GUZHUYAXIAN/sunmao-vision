# 📋 任务积压清单 (Tasks Backlog)

> **用途**: 将以下条目拆分成 GitHub Issues 发布，供开源贡献者认领。
>
> **格式说明**: `[HW-xxx]` 标签对应 `doc/07_核心业务边界与防坑指南.md` 中的"悬赏令"编号。
>
> **优先级**: 🔴 高 / 🟡 中 / 🟢 低
>
> **标签建议**: `good first issue` / `help wanted` / `bug` / `enhancement` / `documentation`

---

## M1: 数据契约实现 ✅ 已完成

> 已在本次执行中完成 Zod Schema 落地。以下为剩余验证工作：

- [ ] 🟡 为 `ModelAssetSchema` 编写合法/非法数据校验测试
- [ ] 🟡 为 `ScaleRecordSchema` 编写合法/非法数据校验测试
- [ ] 🟡 为 `CargoTemplateSchema` 编写合法/非法数据校验测试
- [ ] 🟡 为 `CargoInstanceSchema` 编写合法/非法数据校验测试
- [ ] 🟡 为 `ContainerSchema` 编写合法/非法数据校验测试
- [ ] 🟡 为 `LashingPresetSchema` 编写校验测试 + 验证 6 种预设数据完整性
- [ ] 🟡 为 `SolveRequestSchema` / `SolveResultSchema` 编写复杂嵌套校验测试
- [ ] 🟡 为 `ExportManifestSchema` 编写校验测试
- [ ] 🟡 为 `ProjectSchema` 编写完整项目数据校验测试
- [ ] 🟢 验证 `@sunmao/contracts` 能被 `@sunmao/solver` 和 `@sunmao/web` 正确引用

---

## M2: 求解器核心

### 🧮 算法基础

- [ ] 🔴 `[HW-001]` 实现自由空间管理器 (`solver/algorithms/freeSpace.ts`) — 初始空间 = 容器体积，每次放入后切割剩余空间
- [ ] 🔴 `[HW-001]` 实现 AABB 碰撞检测 (`solver/algorithms/collision.ts`) — 注意面贴面不算碰撞（`<` 而非 `<=`）
- [ ] 🔴 `[HW-001]` 实现核心堆叠算法 (`solver/algorithms/packer.ts`) — 贪心策略：按体积降序，逐个尝试放入最优位置
- [ ] 🔴 实现旋转策略 — 尝试 6 种旋转方向，选择空间利用率最高的
- [ ] 🔴 实现重心稳定性检测 (`solver/algorithms/gravity.ts`) — 底面 ≥70% 被支撑，重心投影在支撑面内

### 🔗 扎带方案

- [ ] 🔴 `[HW-002]` 实现基础扎带方案生成 (`solver/algorithms/lashing.ts`) — 根据放置结果生成固定路径
- [ ] 🟡 实现扎带路径物理约束 — 扎带不能穿过其他货物
- [ ] 🟡 实现扎带用量最小化算法 — 在安全的前提下尽量减少扎带消耗

### 📊 统计与入口

- [ ] 🟡 实现统计计算 (`solver/statistics.ts`) — 净重/毛重/扎带重/利用率
- [ ] 🟡 实现 `solve()` 入口函数 — 组合以上模块，提供统一调用接口
- [ ] 🟡 实现未放置货物报告 — 为无法放入的货物生成 `reason` 说明

### 🧪 测试

- [ ] 🔴 碰撞检测单元测试 — 普通碰撞 / 面贴面 / 嵌套 / 边界
- [ ] 🔴 重心稳定性单元测试 — 地板支撑 / 货物上堆叠 / 悬浮判定
- [ ] 🟡 堆叠算法集成测试 — 完整的 SolveRequest → SolveResult 流程
- [ ] 🟡 统计计算测试 — 重量/利用率的正确性验证
- [ ] 🟡 性能基准测试 — 50 件 <2s / 200 件 <10s / 500 件 <30s

---

## M3: 3D 视口与基础渲染

### 🎨 Three.js 基础

- [ ] 🔴 Three.js 场景初始化 — 场景、相机、灯光、WebGL 渲染器
- [ ] 🔴 OBJ 模型加载器 — 使用 OBJLoader 加载本地 OBJ 文件
- [ ] 🔴 相机控制系统 — 滚轮缩放 / 中键旋转 / Ctrl+拖拽平移 / Shift+拖拽缩放
- [ ] 🟡 V+左键重设旋转中心 — 点击场景某位置后将其设为旋转中心

### 📦 渲染管线

- [ ] 🔴 集装箱渲染 — 线框模式渲染集装箱边界（可拆卸顶面视角）
- [ ] 🔴 货物渲染 — 根据 Placement 坐标放置经缩放的模型
- [ ] 🟡 重量色阶着色 — 根据重量映射颜色到每个货物（红→蓝渐变）
- [ ] 🟡 `[HW-003]` LOD 细节层次策略 — 远粗近细自动切换 (高模 → 低模 → 包围盒)

### 🖱️ 交互基础

- [ ] 🔴 射线检测物体拾取 — 点击识别场景中的货物
- [ ] 🟡 高亮效果 — 选中物体 opacity=1.0，其余 ≤0.4
- [ ] 🟡 悬停浮窗 — 显示货物名称、重量信息

### 💾 数据访问层

- [ ] 🟡 DAL 抽象接口定义 — `loadProject()` / `saveProject()` / `loadModel()` 等
- [ ] 🟡 本地 JSON 实现 — 读写本地 JSON 文件作为存储后端
- [ ] 🟢 预留远程 API 实现接口 — 未来可切换云端存储

---

## M4: 交互功能完善

### 🏗️ 布局系统

- [ ] 🔴 AppShell 五区布局 — 左面板 / 中央 3D 视口 / 右面板 / 顶部操作栏 / 底部信息栏
- [ ] 🟡 响应式断点 — 适配不同屏幕尺寸

### 🌲 树面板

- [ ] 🔴 TreePanel 组件 — 类 Windows 资源管理器的折叠/展开树
- [ ] 🔴 双向联动 — 树面板选中 ↔ 3D 视口高亮 双向同步
- [ ] 🟡 拖拽嵌套 — 树内拖拽 + 3D 拖拽 → 数据层同步移动节点
- [ ] 🟡 `[HW-004]` 3D 拖拽碰撞吸附 — 拖拽到接近合法位置时自动吸附

### ✋ 选中与编辑

- [ ] 🔴 多选模式 — Ctrl+点击追加 / Shift+点击区间 / 全选
- [ ] 🟡 PropertiesPanel — 单击只读查看 / 双击进入编辑模式
- [ ] 🟡 撤销/重做 — Ctrl+Z / Ctrl+Shift+Z 操作栈

### 📦 集装箱管理

- [ ] 🟡 ContainerManager 组件 — 集装箱增删改 UI
- [ ] 🟡 自定义尺寸输入 — 长/宽/高/最大载重/皮重

### ⚖️ 重量可视化

- [ ] 🟡 `[HW-006]` WeightRuler 底部色阶条 — 自定义范围 + 配色方案
- [ ] 🟡 WeightToggle 切换组件 — 净重/毛重切换 + 悬停显示详情

### 📝 引导流程

- [ ] 🟢 WorkflowStepper — 四步设置引导（导入模型 → 配置属性 → 选择集装箱 → 运行求解）

---

## M5: 导出、打磨与优化

### 📊 导出功能

- [ ] 🔴 `[HW-005]` Excel 导出 — 使用 SheetJS 生成装箱清单（多 Sheet + 图表 + 格式化）
- [ ] 🟡 JSON 项目文件导出/导入 — 保存和恢复完整项目状态
- [ ] 🟡 ExportDialog 导出弹窗 — 选择导出内容和格式

### 🎨 UI 美化

- [ ] 🟡 暗色主题设计 — 专业感的深色 UI 配色
- [ ] 🟡 微动画与过渡 — 面板折叠/展开、选中/取消选中的平滑过渡
- [ ] 🟢 加载动画 — 模型加载和求解运行时的进度反馈

### ⚡ 性能优化

- [ ] 🟡 InstancedMesh — 同类型货物共享几何体，减少 draw call
- [ ] 🟡 按需渲染 — 场景无变化时不重绘
- [ ] 🟡 Web Worker 求解 — solver 在 Worker 线程运行，不阻塞 UI

### 🧪 端到端测试

- [ ] 🟢 关键用户流程 E2E 测试 — 创建项目 → 导入模型 → 求解 → 导出
- [ ] 🟢 跨浏览器兼容性验证 — Chrome / Firefox / Edge

### 🌐 国际化

- [ ] 🟢 `[HW-007]` i18n 语言包抽取 — 至少支持中文 + 英文

---

## 📎 通用/持续性任务

- [ ] 🟢 完善 README 中的预览截图/GIF（项目运行后补充）
- [ ] 🟢 配置 GitHub Actions CI — 自动运行 lint / typecheck / test
- [ ] 🟢 发布 GitHub Issue 模板 (Bug Report / Feature Request)
- [ ] 🟢 添加 LICENSE 文件 (MIT)
- [ ] 🟢 创建 CHANGELOG.md

---

> **如何使用此清单**:
>
> 1. 每个 `- [ ]` 条目对应一个 GitHub Issue
> 2. 带有 `[HW-xxx]` 标签的条目应同时标记 `help wanted` label
> 3. 🟢 低优先级的简单条目可标记 `good first issue`
> 4. 按里程碑 (M2→M3→M4→M5) 的顺序创建 GitHub Milestones
> 5. PR 通过验收后勾选对应条目 `- [x]`
