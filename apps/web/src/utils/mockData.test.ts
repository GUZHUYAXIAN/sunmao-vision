import { describe, expect, it } from "vitest";

import { mockRequest } from "./mockData";

describe("mockRequest", () => {
  it("provides a usable seed request for the web workspace", () => {
    expect(mockRequest.containers).toHaveLength(1);
    expect(mockRequest.cargoList.length).toBeGreaterThan(0);
    expect(mockRequest.constraints.allowRotation).toBe(true);
  });
});
