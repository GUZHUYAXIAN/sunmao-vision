# 贡献指南 · Contributing Guide

感谢你对 **榫卯视界 (Sunmao Vision)** 的关注！

本项目是一个开源的集装箱三维可视化自动堆叠系统。我们欢迎所有形式的贡献：代码、文档、Bug 报告、功能建议、业务反馈。

---

## 📌 核心原则

1. **绝不允许直接 Push 到 `main` 分支** — 所有变更必须通过 Pull Request。
2. **一个 PR 只做一件事** — 不要在一个 PR 里混合多个不相关的修改。
3. **先有 Issue，再有 PR** — 在开始大量编码之前，先创建 Issue 讨论方案，避免做无用功。
4. **测试是底线** — 涉及 `packages/solver` 或 `packages/contracts` 的修改，**必须附带对应的测试用例**。

---

## 🔄 贡献流程

### Step 1: Fork 仓库

点击 GitHub 页面右上角的 **Fork** 按钮，将仓库 Fork 到你的个人账号下。

### Step 2: 克隆到本地

```bash
git clone https://github.com/<你的用户名>/sunmao-vision.git
cd sunmao-vision
pnpm install
```

### Step 3: 创建特性分支

**从 `main` 分支创建**，命名遵循以下规范：

```bash
# 新功能
git checkout -b feat/collision-detection

# Bug 修复
git checkout -b fix/weight-calculation-error

# 文档改进
git checkout -b docs/improve-readme

# 重构
git checkout -b refactor/dal-interface
```

| 前缀 | 用途 |
|---|---|
| `feat/` | 新功能 |
| `fix/` | Bug 修复 |
| `docs/` | 文档变更 |
| `refactor/` | 重构（不改变外部行为） |
| `test/` | 测试相关 |
| `chore/` | 构建/工具配置 |

### Step 4: 开发与提交

#### 提交信息格式

```
<类型>(<范围>): <简短描述>

示例:
  feat(solver): implement AABB collision detection
  fix(web): fix weight ruler not updating on container change
  docs(repo): add architecture overview document
  test(contracts): add validation tests for CargoTemplate schema
```

**范围 (scope)** 对应 Monorepo 中的包名：

| 范围 | 对应目录 |
|---|---|
| `contracts` | `packages/contracts/` |
| `solver` | `packages/solver/` |
| `web` | `apps/web/` |
| `repo` | 仓库根级文件 |

#### 提交频率

- **小步快跑** — 每完成一个独立的逻辑单元就提交一次。
- **不要攒一大堆改动然后做一个巨型提交**。

### Step 5: 推送并发起 PR

```bash
git push origin feat/你的分支名
```

然后在 GitHub 上发起 Pull Request，目标分支为 `main`。

> ⚠️ PR 提交时会自动加载 [PR 模板](./.github/PULL_REQUEST_TEMPLATE.md)，**请认真填写每一项检查清单**。

### Step 6: 等待审查

项目维护者会对你的 PR 进行审查。请注意：

- 审查可能需要 1~3 天，请耐心等待。
- 如果需要修改，请直接在同一个分支上提交新的 commit，PR 会自动更新。
- PR 通过审查后，维护者会使用 **Squash Merge** 合并到 `main`。

---

## 🔍 审查标准

作为维护者，我会从以下几个维度审查每一个 PR：

### 1. 代码规范 ✅

- TypeScript 类型安全（不允许 `any`）
- 遵循项目的命名约定和代码风格
- 通过 ESLint + Prettier 检查
- 不引入不必要的依赖

### 2. 业务逻辑 ✅

> 这是最严格的审查维度。

本项目涉及**物理堆叠**——货物的碰撞检测、重心稳定性、空间利用率。这不是普通的 CRUD 应用。

**我会严格验证**：
- 碰撞检测是否有遗漏（货物之间、货物与集装箱壁之间）
- 重量计算是否正确（净重、毛重、扎带重量）
- 放置坐标是否在集装箱边界内
- 堆叠方案是否符合物理常识（不能悬浮、重心必须在支撑面内）

### 3. 渲染效果 ✅

所有涉及 3D 渲染或 UI 交互的 PR，**必须在 PR 描述中附上截图或录屏**。

我会检查：
- 3D 场景中的物体是否正确渲染
- 交互操作是否流畅
- 没有视觉 Bug（闪烁、穿模、Z-fighting 等）

### 4. 测试覆盖 ✅

- `packages/solver` 的修改 → 必须有单元测试
- `packages/contracts` 的修改 → 必须有 schema 验证测试
- `apps/web` 的修改 → 建议有组件测试

---

## 📁 项目结构速查

```
sunmao-vision/
├── packages/
│   ├── contracts/     📜 Zod Schema 数据契约（零 UI 依赖）
│   └── solver/        🧮 堆叠求解引擎（零 UI 依赖）
├── apps/
│   └── web/           🖥️ React + Three.js 前端应用
├── doc/               📚 架构设计文档
│   └── architecture/  详细设计文档
├── legacy_code/       🏚️ 旧代码存档（不参与构建）
└── .github/           GitHub 配置（PR 模板等）
```

> 📖 详细的架构地图请阅读 [`doc/06_新版系统架构与重构寻宝图.md`](./doc/06_新版系统架构与重构寻宝图.md)

---

## 🧭 不知道从哪里开始？

1. **浏览 Issues** — 看看有没有标记为 `good first issue` 或 `help wanted` 的任务。
2. **阅读架构文档** — 先花 20 分钟理解 [架构总览](./doc/architecture/01-architecture-overview.md) 和 [数据契约](./doc/architecture/02-data-contracts.md)。
3. **阅读防坑指南** — [`doc/07_核心业务边界与防坑指南.md`](./doc/07_核心业务边界与防坑指南.md) 里有"悬赏令"清单，挑一个你擅长的领域开干！
4. **跑起来先** — `pnpm install && pnpm dev`，先在浏览器里感受一下项目。

---

## 💬 沟通

- **Issue**: 功能讨论、Bug 报告、方案提案
- **PR Comment**: 代码级别的技术讨论
- **Discussion** (未来): 更广泛的社区讨论

---

## 📜 行为准则

我们希望打造一个友好、包容、专业的开源社区。请在参与时保持尊重和建设性。

---

**再次感谢你的贡献！每一个 PR，无论大小，都在推动集装箱行业的数字化变革。**

> 🇨🇳 以工匠精神，共建开源未来。
