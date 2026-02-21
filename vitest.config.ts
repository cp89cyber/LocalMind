import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      sqlite: "node:sqlite"
    }
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    server: {
      deps: {
        external: ["node:sqlite", "sqlite"]
      }
    }
  }
});
