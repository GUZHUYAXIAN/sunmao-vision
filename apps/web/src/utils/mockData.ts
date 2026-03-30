import { SolveRequest } from "@sunmao/contracts";

export const mockRequest: SolveRequest = {
  containers: [
    {
      id: "9f8a3c8e-1234-4bc3-a55e-000000000001",
      name: "20尺标准集装箱",
      length: 5898,
      width: 2352,
      height: 2393,
      maxPayload: 28000,
      tareWeight: 2200,
    },
  ],
  cargoList: [
    {
      id: "cfa1c30a-1111-4bb1-a123-000000000001",
      modelId: "m-001",
      displayName: "大型发动机壳体",
      dimensions: {
        length: 1200,
        width: 800,
        height: 1000,
      },
      weight: 500,
      quantity: 5,
      color: "#ff5555",
    },
    {
      id: "cfa1c30a-2222-4bb1-a123-000000000002",
      modelId: "m-002",
      displayName: "长条形传动轴",
      dimensions: {
        length: 2000,
        width: 400,
        height: 400,
      },
      weight: 200,
      quantity: 10,
      color: "#55ff55",
    },
    {
      id: "cfa1c30a-3333-4bb1-a123-000000000003",
      modelId: "m-003",
      displayName: "小型控制盒",
      dimensions: {
        length: 500,
        width: 500,
        height: 500,
      },
      weight: 50,
      quantity: 20,
      color: "#5555ff",
    },
  ],
  lashing: {
    strapping: {
      code: "PET-Heavy",
      name: "PET 塑钢打包带",
      category: "strapping",
      material: "聚酯 (PET)",
      width: 19,
      thickness: 1.0,
      workingLoad: 450,
      breakingForce: 680,
      selfWeight: 14.2,
    },
    tieDown: {
      code: "Ratchet-50",
      name: "50mm 标准拉紧器",
      category: "ratchet",
      material: "涤纶织带 + 钢棘轮",
      width: 50,
      workingLoad: 2000,
      breakingForce: 6000,
      selfWeight: 850,
    },
  },
  constraints: {
    allowRotation: true,
    gravityCheck: true,
  },
};
