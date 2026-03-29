# 数据契约 (Data Contracts)

> **文档版本**: v1.0
> **最后更新**: 2026-03-30
> **状态**: 设计完成，待评审

本文档定义了系统中所有模块之间传递数据时必须遵守的格式规范。所有结构使用 Zod Schema 定义，同时自动导出对应的 TypeScript 类型。

---

## 1. 模型相关

### 1.1 ModelAsset（模型资产）

从 PDF 生成的原始 OBJ 文件的登记记录。

```typescript
import { z } from "zod";

export const ModelAssetSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().min(1),          // OBJ 文件名，如 "发动机壳体.obj"
  sourcePdf: z.string().min(1),         // 来源 PDF 名称
  sourcePage: z.number().int().min(1),  // 来自 PDF 第几页
  filePath: z.string().min(1),          // 本地存储路径
  createdAt: z.string().datetime(),
});

export type ModelAsset = z.infer<typeof ModelAssetSchema>;
```

### 1.2 ScaleRecord（缩放因子记录）

模型经过尺寸标定后的校准数据。

```typescript
export const ScaleRecordSchema = z.object({
  modelId: z.string().uuid(),            // 对应的 ModelAsset ID
  scaleFactors: z.tuple([
    z.number().positive(),               // X 轴缩放因子
    z.number().positive(),               // Y 轴缩放因子
    z.number().positive(),               // Z 轴缩放因子
  ]),
  realDimensions: z.object({
    length: z.number().positive(),       // 真实长度 (mm)
    width: z.number().positive(),        // 真实宽度 (mm)
    height: z.number().positive(),       // 真实高度 (mm)
  }),
  calibratedBy: z.string().min(1),       // 标定人
  calibratedAt: z.string().datetime(),   // 标定时间
});

export type ScaleRecord = z.infer<typeof ScaleRecordSchema>;
```

---

## 2. 货物相关

### 2.1 CargoTemplate（货物模板）

一种货物的"产品说明书"——包含该种货物的所有固有属性。

```typescript
export const CargoTemplateSchema = z.object({
  id: z.string().uuid(),
  modelId: z.string().uuid(),            // 关联的 ModelAsset ID
  displayName: z.string().min(1),        // 显示名称
  dimensions: z.object({
    length: z.number().positive(),       // 长 (mm)
    width: z.number().positive(),        // 宽 (mm)
    height: z.number().positive(),       // 高 (mm)
  }),
  weight: z.number().nonnegative(),      // 单件重量 (kg)
  quantity: z.number().int().min(1),     // 需要装箱的数量
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/), // 3D 场景中的显示颜色

  // 扩展属性
  category: z.string().optional(),       // 类别（如"机械零件"）
  density: z.number().positive().optional(),   // 密度 (g/cm³)
  material: z.string().optional(),       // 材质
  price: z.number().nonnegative().optional(),  // 单价 (¥)
});

export type CargoTemplate = z.infer<typeof CargoTemplateSchema>;
```

### 2.2 CargoInstance（货物实例）

具体放在某个位置的那一个货物。

```typescript
export const CargoLocationEnum = z.enum(["staging", "container"]);

export const CargoInstanceSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),         // 所属 CargoTemplate 的 ID
  location: CargoLocationEnum,           // "staging"=暂存区, "container"=已入柜
  containerId: z.string().uuid().optional(), // 在哪个集装箱里（仅 location=container 时）
  position: z.tuple([
    z.number(), z.number(), z.number(),  // [x, y, z] 坐标 (mm)
  ]),
  rotation: z.tuple([
    z.number(), z.number(), z.number(),  // [rx, ry, rz] 旋转角度 (度)
  ]).default([0, 0, 0]),
  selected: z.boolean().default(false),  // 是否被选中
});

export type CargoInstance = z.infer<typeof CargoInstanceSchema>;
```

---

## 3. 集装箱相关

### 3.1 Container（集装箱）

用户可手动添加多个集装箱，每个集装箱的尺寸和载重独立配置。

```typescript
export const ContainerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),               // 名称，如 "20尺标准柜"
  length: z.number().positive(),         // 内部长度 (mm)
  width: z.number().positive(),          // 内部宽度 (mm)
  height: z.number().positive(),         // 内部高度 (mm)
  maxPayload: z.number().positive(),     // 最大载货重量 (kg)
  tareWeight: z.number().nonnegative().default(0),
  // 集装箱自身重量(皮重) kg
  // 用户不输入默认为 0，此时净重 = 毛重
});

export type Container = z.infer<typeof ContainerSchema>;
```

---

## 4. 扎带相关

### 4.1 LashingPreset（扎带预设规格）

系统内置常用扎带规格，用户选择即可，无需手动填写物理参数。

```typescript
export const LashingCategoryEnum = z.enum(["strapping", "ratchet"]);

export const LashingPresetSchema = z.object({
  code: z.string(),                      // 规格代号, 如 "PET-Heavy"
  name: z.string(),                      // 显示名称
  category: LashingCategoryEnum,         // "strapping"=打包带, "ratchet"=拉紧器
  material: z.string(),                  // 材质
  width: z.number().positive(),          // 宽度 (mm)
  thickness: z.number().positive().optional(), // 厚度 (mm, 打包带专用)
  workingLoad: z.number().positive(),    // 工作载荷 (kg)
  breakingForce: z.number().positive(),  // 破断拉力 (kg)
  selfWeight: z.number().positive(),     // 单位长度重量 (g/m)
});

export type LashingPreset = z.infer<typeof LashingPresetSchema>;
```

### 4.2 内置扎带规格表

#### 打包带（Strapping Band）

| 代号 | 名称 | 材质 | 宽度 mm | 厚度 mm | 破断拉力 kg | 适用场景 |
|---|---|---|---|---|---|---|
| `PP-Standard` | PP 塑料打包带 | 聚丙烯 | 16 | 0.6 | 250 | 轻型货物、纸箱 |
| `PET-Heavy` | PET 塑钢打包带 | 聚酯 | 19 | 1.0 | 680 | 中重型货物 |
| `Steel-Band` | 钢带 | 热处理钢 | 19 | 0.8 | 1800 | 重型/超重型货物 |

#### 棘轮拉紧器（Ratchet Tie-Down）

| 代号 | 名称 | 带宽 mm | 工作载荷 kg | 破断力 kg | 适用场景 |
|---|---|---|---|---|---|
| `Ratchet-25` | 25mm 轻型拉紧器 | 25 | 500 | 1500 | 小件/轻型固定 |
| `Ratchet-50` | 50mm 标准拉紧器 | 50 | 2000 | 6000 | 中型货物（最常用） |
| `Ratchet-75` | 75mm 重型拉紧器 | 75 | 5000 | 15000 | 重型机械设备 |

---

## 5. 求解器输入/输出

### 5.1 SolveRequest（求解请求）

类比有限元分析中提交给求解器的 `.inp` 输入文件。

```typescript
export const SolveConstraintsSchema = z.object({
  allowRotation: z.boolean().default(true),     // 是否允许旋转货物
  gravityCheck: z.boolean().default(true),       // 是否检测重心稳定性
  maxStackLayers: z.number().int().min(1).optional(), // 最大堆叠层数
});

export const LashingConfigSchema = z.object({
  strapping: LashingPresetSchema,               // 选择的打包带规格
  tieDown: LashingPresetSchema,                 // 选择的拉紧器规格
});

export const SolveRequestSchema = z.object({
  containers: z.array(ContainerSchema).min(1),  // 至少一个集装箱
  cargoList: z.array(CargoTemplateSchema).min(1), // 至少一种货物
  lashing: LashingConfigSchema,                 // 扎带配置
  constraints: SolveConstraintsSchema,          // 求解约束条件
});

export type SolveRequest = z.infer<typeof SolveRequestSchema>;
```

### 5.2 SolveResult（求解结果）

类比有限元分析的 `.odb`/`.rst` 结果文件。

```typescript
export const PlacementSchema = z.object({
  cargoIndex: z.number().int().nonnegative(),    // 对应 cargoList 中的序号
  instanceIndex: z.number().int().nonnegative(), // 该种货物的第几个实例
  containerId: z.string().uuid(),                // 放入的集装箱 ID
  position: z.tuple([z.number(), z.number(), z.number()]), // [x,y,z] mm
  rotation: z.tuple([z.number(), z.number(), z.number()]), // [rx,ry,rz] 度
});

export type Placement = z.infer<typeof PlacementSchema>;

export const LashingStrapSchema = z.object({
  type: z.enum(["strapping", "tieDown"]),
  presetCode: z.string(),                        // 使用的规格代号
  fromPoint: z.tuple([z.number(), z.number(), z.number()]),
  toPoint: z.tuple([z.number(), z.number(), z.number()]),
  securedItems: z.array(z.string().uuid()),      // 固定的货物实例 ID
});

export const ContainerLashingPlanSchema = z.object({
  containerId: z.string().uuid(),
  straps: z.array(LashingStrapSchema),
});

export const ContainerStatsSchema = z.object({
  containerId: z.string().uuid(),
  itemCount: z.number().int().nonnegative(),     // 装入数量
  netWeight: z.number().nonnegative(),           // 净重 = 纯货物重量 (kg)
  lashingWeight: z.number().nonnegative(),       // 扎带总重 (kg)
  grossWeight: z.number().nonnegative(),
  // 毛重 = 货物 + 扎带 + 集装箱皮重 (kg)
  utilization: z.number().min(0).max(100),       // 体积利用率 %
});

export const WarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  relatedItems: z.array(z.string().uuid()).optional(),
});

export const SolveResultSchema = z.object({
  success: z.boolean(),
  placements: z.array(PlacementSchema),
  unplacedItems: z.array(z.object({
    cargoIndex: z.number().int().nonnegative(),
    reason: z.string(),
  })),
  lashingPlan: z.array(ContainerLashingPlanSchema),
  statistics: z.object({
    perContainer: z.array(ContainerStatsSchema),
    totalNetWeight: z.number().nonnegative(),
    totalGrossWeight: z.number().nonnegative(),
    overallUtilization: z.number().min(0).max(100),
  }),
  warnings: z.array(WarningSchema),
  solvedAt: z.string().datetime(),
  solveTimeMs: z.number().nonnegative(),         // 求解耗时 (毫秒)
});

export type SolveResult = z.infer<typeof SolveResultSchema>;
```

---

## 6. 导出相关

### 6.1 ExportManifest（装箱清单）

用于生成 Excel 导出文件的数据结构。

```typescript
export const ManifestItemSchema = z.object({
  id: z.string(),                        // 货物 ID
  name: z.string(),                      // 货物名称
  quantity: z.number().int().min(1),     // 数量
  unitWeight: z.number().nonnegative(),  // 单重 (kg)
  totalWeight: z.number().nonnegative(), // 总重 = 单重 × 数量 (kg)
  dimensions: z.string(),               // 尺寸描述，如 "800×500×300"
  position: z.string(),                 // 放置坐标描述
});

export const ContainerManifestSchema = z.object({
  containerName: z.string(),
  containerSpec: z.string(),             // 规格, 如 "6058×2438×2591"
  tareWeight: z.number().nonnegative(),  // 集装箱皮重 (kg)
  items: z.array(ManifestItemSchema),
  lashingUsed: z.array(z.object({
    type: z.string(),                    // 扎带类型
    specification: z.string(),           // 规格名称
    quantityOrLength: z.string(),        // 使用数量或长度
  })),
  summary: z.object({
    itemCount: z.number().int().nonnegative(),   // 货物总数
    netWeight: z.number().nonnegative(),          // 净重 (kg)
    lashingWeight: z.number().nonnegative(),      // 扎带重量 (kg)
    grossWeight: z.number().nonnegative(),        // 毛重 (kg)
    utilization: z.number().min(0).max(100),      // 利用率 %
  }),
});

export const ExportManifestSchema = z.object({
  projectName: z.string(),
  exportedAt: z.string().datetime(),
  containers: z.array(ContainerManifestSchema),
  grandTotal: z.object({
    totalContainers: z.number().int().min(1),
    totalItems: z.number().int().nonnegative(),
    totalNetWeight: z.number().nonnegative(),
    totalGrossWeight: z.number().nonnegative(),
  }),
});

export type ExportManifest = z.infer<typeof ExportManifestSchema>;
```

---

## 7. 项目级别

### 7.1 Project（项目）

类比有限元的 `.cae` 项目文件——包含一个项目的全部信息。

```typescript
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  models: z.array(ModelAssetSchema),
  scaleRecords: z.array(ScaleRecordSchema),
  templates: z.array(CargoTemplateSchema),
  containers: z.array(ContainerSchema),
  solveResult: SolveResultSchema.optional(), // 最新求解结果（可能尚未求解）
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof ProjectSchema>;
```

---

## 8. 数据关系图

```
Project
 ├── ModelAsset[]                 原始 OBJ 模型列表
 │     └── ScaleRecord            每个模型的标定记录
 │           └── CargoTemplate    标定后生成的货物模板
 │                 └── CargoInstance[]  具体放置实例（求解后生成）
 ├── Container[]                  集装箱列表（用户手动添加）
 ├── LashingConfig                扎带选择（打包带 + 拉紧器）
 ├── SolveRequest                 → 提交给 solver
 └── SolveResult                  ← solver 返回
       ├── Placement[]            放置结果
       ├── LashingPlan[]          扎带固定方案
       ├── Statistics             重量/利用率统计
       ├── Warning[]              警告信息
       └── ExportManifest         → 导出 Excel
```
