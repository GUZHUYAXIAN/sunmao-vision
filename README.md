# 榫卯视界 Sunmao Vision

![Status: Refactoring](https://img.shields.io/badge/Status-Refactoring-orange?style=for-the-badge)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](./LICENSE)
![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=for-the-badge)
![Three.js](https://img.shields.io/badge/Made_With-Three.js-black?style=for-the-badge&logo=three.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)

> 🏗️ 当两千年前的中国榫卯智慧，遇上现代 3D 数字孪生

*一个开源的集装箱三维可视化自动堆叠系统*  
*An open-source 3D container loading optimization & visualization system*

---

## 🌏 缘起 · Origin

> 榫卯（sǔn mǎo），中国古代建筑与家具中最精妙的连接工艺。
> 无需一钉一铆，仅凭木构件之间的凹凸咬合，便能承受千年风雨。
>
> **我们的追问是**：如果把这种"每一寸空间都不浪费"的极致智慧，注入到现代物流装箱中，会发生什么？

**榫卯视界 (Sunmao Vision)** 正是这个追问的答案——一个将传统空间智慧与现代 3D 数字孪生技术融合的开源系统。

我们的目标：**让每一个集装箱都像一件榫卯作品——严丝合缝、滴水不漏。**

---

## ✨ 核心特性 · Features

| 特性 | 描述 |
| --- | --- |
| 🧮 **智能求解器** | "计算与渲染分离"架构——纯算法后端，像有限元求解器一样输入参数、输出最优方案 |
| 🎨 **3D 实时可视化** | 基于 Three.js 的浏览器端三维渲染，支持旋转、缩放、平移、物体拾取等交互 |
| 📐 **PDF → 3D 模型** | 将工程图纸自动转换为 OBJ 三维模型，并支持尺寸标定校准 |
| 🔗 **扎带固定方案** | 求解器同步生成货物捆扎固定策略，内置 6 种常用扎带规格预设 |
| ⚖️ **重量可视化** | 重量色阶渐变（红→蓝）、净重/毛重切换显示、悬停浮窗 |
| 📦 **多集装箱管理** | 支持多种规格集装箱并行管理，独立配置尺寸和载重 |
| 📊 **一键导出** | 生成专业的 Excel 装箱清单，包含重量明细、扎带用量、利用率统计 |
| 🌲 **层级树面板** | 类 Windows 资源管理器的折叠树结构，支持拖拽移动、多选、双向联动 |

---

## 🏛️ 架构 · Architecture

```text
sunmao-vision/
├── packages/
│   ├── contracts/          📜 统一数据契约 (Zod Schemas)
│   │                        系统的"共同语言"，所有模块必须遵守
│   └── solver/             🧮 堆叠求解引擎
│                            纯计算，零 UI 依赖，可独立运行和测试
├── apps/
│   └── web/                🖥️ React + Three.js 前端
│                            3D 可视化、交互、数据访问层
├── doc/                    📚 架构设计与开发指南
└── legacy_code/            🏚️ 旧代码存档（不参与构建，仅供参考）
```

**设计哲学**：借鉴有限元分析软件（ANSYS / Abaqus）的经典架构——

| 有限元 | 榫卯视界 |
| --- | --- |
| 求解器 (Solver) | `packages/solver` |
| 前/后处理器 | `apps/web` |
| 数据文件 (.inp / .odb) | `packages/contracts` |

> 📖 详细架构设计请阅读 [`doc/architecture/`](./doc/architecture/) 目录下的完整文档。

---

## 🚧 开发状态 · Status

> **当前阶段：全面重构中 (Major Refactoring)**

本项目正在从早期原型代码重构为企业级 Monorepo 架构。我们已完成：

- [x] 架构设计与技术选型
- [x] 数据契约 (Data Contracts) 设计
- [x] 前端交互规范设计
- [x] 实施路线图制定
- [x] 开源社区基石文档
- [ ] **M0: 基础设施搭建** ← 即将开始
- [ ] M1: 数据契约实现
- [ ] M2: 求解器核心
- [ ] M3: 3D 视口与渲染
- [ ] M4: 交互功能完善
- [ ] M5: 导出与打磨

> 📍 详见 [实施路线图](./doc/architecture/05-implementation-roadmap.md)

---

## 🤝 参与贡献 · Contributing

**这是一个开放的项目，我们热烈欢迎每一位贡献者！**

无论你是：

- 🧊 **3D 图形极客** — 帮助优化渲染管线和 LOD 策略
- 🧮 **算法高手** — 挑战堆叠求解器的空间利用率极限
- 🎨 **前端达人** — 打造丝滑的交互体验
- 📐 **工程/物流从业者** — 提供真实场景的业务反馈
- 📖 **文档爱好者** — 帮助完善技术文档和国际化翻译

你都可以通过标准的 **Fork → Branch → PR** 流程参与共建。

> 📖 请务必阅读 [**CONTRIBUTING.md**](./CONTRIBUTING.md) 了解完整的贡献指南。

### 🎯 急待解决的硬核难点 (Help Wanted)

我们在 [`doc/07_核心业务边界与防坑指南.md`](./doc/07_核心业务边界与防坑指南.md) 中维护了一份"**悬赏令**"清单——那些最具挑战性的技术难题。如果你是高手，欢迎来挑战！

---

## 🛠️ 技术栈 · Tech Stack

| 领域 | 技术 |
| --- | --- |
| 前端框架 | React 19 + TypeScript 5 |
| 构建工具 | Vite 6 |
| 3D 引擎 | Three.js |
| 数据校验 | Zod 3 |
| 测试框架 | Vitest |
| 包管理 | pnpm workspace (Monorepo) |
| 模型格式 | OBJ (Wavefront) |
| 导出 | SheetJS (Excel) |

---

## 📜 开源协议 · License

本项目采用 [MIT License](./LICENSE) 开源。

---

## 💡 项目名释义

**榫卯 (Sunmao)** — 源自中国古代木工技艺，代表"空间利用的极致智慧"。

**视界 (Vision)** — 三维可视化的"视"，架构远见的"界"。

> 🇨🇳 以两千年前的工匠精神，驱动今天的数字化物流。
>
> In the spirit of ancient Chinese craftsmanship, powering modern digital logistics.

---

**⭐ 如果这个项目对你有启发，请给一颗 Star！**  
**⭐ If this project inspires you, please give it a Star!**
