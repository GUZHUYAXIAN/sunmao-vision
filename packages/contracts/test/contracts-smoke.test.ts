import { describe, expect, it } from "vitest";

import { ContainerSchema, SolveRequestSchema } from "../src";

const container = {
  id: "9f8a3c8e-1234-4bc3-a55e-000000000001",
  name: "20尺标准集装箱",
  length: 5898,
  width: 2352,
  height: 2393,
  maxPayload: 28000,
};

const cargo = {
  id: "cfa1c30a-1111-4bb1-a123-000000000001",
  modelId: "aaaaaaaa-1111-4bb1-a123-000000000001",
  displayName: "大型发动机壳体",
  dimensions: {
    length: 1200,
    width: 800,
    height: 1000,
  },
  weight: 500,
  quantity: 5,
  color: "#ff5555",
};

describe("@sunmao/contracts schema smoke tests", () => {
  it("applies the default container tare weight", () => {
    const parsed = ContainerSchema.parse(container);

    expect(parsed.tareWeight).toBe(0);
  });

  it("rejects solve requests without cargo", () => {
    const parsed = SolveRequestSchema.safeParse({
      containers: [container],
      cargoList: [],
      constraints: {
        allowRotation: true,
        gravityCheck: true,
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts a minimal solve request payload", () => {
    const parsed = SolveRequestSchema.safeParse({
      containers: [container],
      cargoList: [cargo],
      constraints: {
        allowRotation: true,
        gravityCheck: true,
      },
    });

    expect(parsed.success).toBe(true);
  });
});
