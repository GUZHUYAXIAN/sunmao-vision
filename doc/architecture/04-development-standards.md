# 开发规范与 GitHub 协作流程

> **文档版本**: v1.0
> **最后更新**: 2026-03-30
> **状态**: 设计完成，待评审

本文档定义了项目的编码标准、Git 分支策略、以及 PR 流程规范。

---

## 1. 技术栈编码规范

### 1.1 TypeScript 规范

#### 命名约定

```typescript
// ✅ 正确：描述性名称，动词-名词模式
const maxStackLayers = 5;
const isContainerFull = checkCapacity(container);
function calculateUtilization(container: Container): number {}
function loadObjModel(filePath: string): Promise<Group> {}

// ❌ 错误：缩写、无意义名称
const msl = 5;
const flag = checkCapacity(c);
function calc(c) {}
```

#### 类型安全

```typescript
// ✅ 正确：使用契约中定义的 Zod 类型
import type { Container, CargoTemplate } from "@sunmao/contracts";

function addCargo(container: Container, cargo: CargoTemplate): void {}

// ❌ 错误：使用 any 或松散类型
function addCargo(container: any, cargo: any): void {}
```

#### 不可变更新

```typescript
// ✅ 正确：使用展开运算符
const updatedContainer = { ...container, name: "新名称" };
const updatedList = [...cargoList, newCargo];

// ❌ 错误：直接修改
container.name = "新名称";
cargoList.push(newCargo);
```

#### Guard Clause 模式

```typescript
// ✅ 正确：早返回，减少嵌套
function placeCargo(containerId: string, cargo: CargoInstance) {
  const container = findContainer(containerId);
  if (!container) return { error: "container_not_found" };

  if (isOverWeight(container, cargo)) return { error: "weight_exceeded" };

  if (hasCollision(container, cargo)) return { error: "collision_detected" };

  return { success: true, placement: computePlacement(container, cargo) };
}

// ❌ 错误：深层嵌套
function placeCargo(containerId: string, cargo: CargoInstance) {
  const container = findContainer(containerId);
  if (container) {
    if (!isOverWeight(container, cargo)) {
      if (!hasCollision(container, cargo)) {
        return { success: true };
      }
    }
  }
}
```

### 1.2 React 规范

#### 组件结构

```typescript
// ✅ 正确：明确的 Props 接口 + 函数组件
interface WeightRulerProps {
  minWeight: number;
  maxWeight: number;
  levels: 10 | 15 | 20;
  colorScheme?: string;
  onRangeChange?: (min: number, max: number) => void;
}

export function WeightRuler({
  minWeight,
  maxWeight,
  levels,
  colorScheme = "red-blue",
  onRangeChange,
}: WeightRulerProps) {
  // 组件逻辑
}
```

#### 状态管理

```typescript
// ✅ 正确：函数式更新
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

setSelectedIds((previous) => {
  const next = new Set(previous);
  next.add(itemId);
  return next;
});

// ❌ 错误：基于旧值的非安全更新
setSelectedIds(new Set([...selectedIds, itemId]));
```

#### Hooks 使用

```typescript
// ✅ 正确：useMemo 缓存昂贵计算
const weightColorMap = useMemo(() => {
  return buildColorMap(cargoTemplates, weightScale);
}, [cargoTemplates, weightScale]);

// ✅ 正确：useCallback 缓存事件处理器
const handleItemClick = useCallback(
  (itemId: string, event: React.MouseEvent) => {
    applySelectionIntent(itemId, event.ctrlKey, event.shiftKey);
  },
  [applySelectionIntent],
);
```

### 1.3 CSS 规范

- 使用 **Vanilla CSS** + CSS 变量（Custom Properties）
- 不使用 Tailwind CSS
- 设计系统的颜色、间距、字体等通过 CSS 变量管理

```css
:root {
  /* 颜色系统 */
  --color-primary: hsl(220, 75%, 55%);
  --color-surface: hsl(220, 15%, 12%);
  --color-text: hsl(220, 10%, 92%);
  --color-weight-heavy: hsl(0, 80%, 55%); /* 重量标尺：红色 */
  --color-weight-light: hsl(195, 80%, 65%); /* 重量标尺：天蓝色 */

  /* 间距系统 */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* 布局 */
  --sidebar-width: 280px;
  --properties-width: 300px;
  --topbar-height: 48px;
  --bottombar-height: 44px;
}
```

---

## 2. 文件组织规范

### 2.1 目录结构约定

| 目录          | 内容         | 命名方式                        |
| ------------- | ------------ | ------------------------------- |
| `components/` | React 组件   | `PascalCase.tsx`                |
| `hooks/`      | 自定义 Hooks | `camelCase.ts`（以 `use` 前缀） |
| `dal/`        | 数据访问层   | `camelCase.ts`                  |
| `stores/`     | 状态管理     | `camelCase.ts`                  |
| `utils/`      | 工具函数     | `camelCase.ts`                  |
| `styles/`     | 全局样式     | `kebab-case.css`                |
| `__tests__/`  | 测试文件     | `*.test.ts` / `*.test.tsx`      |

### 2.2 导入顺序

```typescript
// 1. 外部依赖
import { useState, useCallback } from "react";
import * as THREE from "three";

// 2. Monorepo 内部包
import type { Container, CargoTemplate } from "@sunmao/contracts";
import { solve } from "@sunmao/solver";

// 3. 项目内部模块
import { useSelection } from "../hooks/useSelection";
import { TreePanel } from "../components/panels/TreePanel";

// 4. 样式
import "./styles/workspace.css";
```

---

## 3. 测试规范

### 3.1 测试策略

| 层级     | 覆盖范围                            | 工具                     |
| -------- | ----------------------------------- | ------------------------ |
| 单元测试 | `packages/contracts` 的 schema 验证 | Vitest                   |
| 单元测试 | `packages/solver` 的算法逻辑        | Vitest                   |
| 组件测试 | React 组件的渲染和交互              | Vitest + Testing Library |
| 集成测试 | 前端调用 solver 的完整流程          | Vitest                   |

### 3.2 测试命名

```typescript
// ✅ 正确：描述具体行为
test("returns collision error when cargo overlaps existing placement", () => {});
test("selects range of items between first and last clicked when Shift held", () => {});
test("reduces opacity of unselected items to 0.4 when item is selected", () => {});

// ❌ 错误：模糊描述
test("works correctly", () => {});
test("test collision", () => {});
```

### 3.3 Solver 测试优先级

由于 solver 是纯计算模块，测试覆盖率要求最高：

```typescript
describe("packer", () => {
  test("places single item at origin of empty container", () => {});
  test("stacks items vertically when floor space is filled", () => {});
  test("rotates item to fit when original orientation does not fit", () => {});
  test("rejects item that exceeds container max payload", () => {});
  test("returns unplaced items with reason when container is full", () => {});
});
```

---

## 4. Git 分支策略

遵循 `workflow_rules.md` 中定义的规范，此处整理为快速参考：

### 4.1 分支命名

```text
main                          ← 主分支，始终可发布
├── feat/monorepo-setup       ← 新功能
├── feat/solver-packer        ← 新功能
├── feat/3d-viewport          ← 新功能
├── fix/lod-flicker           ← Bug 修复
├── docs/architecture         ← 文档
└── refactor/dal-interface    ← 重构
```

### 4.2 提交信息格式

```text
<类型>(<范围>): <简短描述>

类型:
  feat     新功能
  fix      Bug 修复
  docs     文档变更
  style    代码格式（不影响功能）
  refactor 重构
  test     测试相关
  chore    构建/工具

范围:
  contracts  数据契约包
  solver     求解器包
  web        前端应用
  repo       仓库级别

示例:
  feat(contracts): add LashingPreset schema
  feat(solver): implement collision detection
  fix(web): fix selection opacity not restoring
  docs(repo): add architecture overview document
```

### 4.3 PR 流程

```text
1. 创建 Issue（描述需求/Bug）
2. 从 main 创建功能分支
3. 开发 + 测试
4. 提交 PR（关联 Issue）
5. 代码评审 (Code Review)
6. Squash Merge 到 main
7. 删除功能分支
```

---

## 5. 开发环境配置

### 5.1 前置要求

| 工具    | 最低版本 | 用途     |
| ------- | -------- | -------- |
| Node.js | 20.x     | 运行环境 |
| pnpm    | 10.x     | 包管理器 |
| Git     | 2.40+    | 版本控制 |

### 5.2 初始化命令

```bash
# 克隆仓库
git clone https://github.com/<user>/sunmao-vision.git
cd sunmao-vision

# 安装依赖（pnpm workspace 自动处理所有子包）
pnpm install

# 启动前端开发服务器
pnpm --filter @sunmao/web dev

# 运行测试
pnpm test                    # 全部测试
pnpm --filter @sunmao/solver test   # 仅求解器测试
pnpm --filter @sunmao/contracts test # 仅契约测试
```

### 5.3 Monorepo Workspace 配置

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"
```

```json
// 根级 package.json
{
  "name": "sunmao-vision",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @sunmao/web dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  }
}
```
