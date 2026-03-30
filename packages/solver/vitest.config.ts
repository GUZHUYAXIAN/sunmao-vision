import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@sunmao/contracts": resolve(__dirname, "../contracts/dist/index.js"),
    },
  },
  test: {
    globals: false,
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    typecheck: {
      tsconfig: "./tsconfig.json",
    },
  },
});
