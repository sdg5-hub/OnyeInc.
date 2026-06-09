import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    // Node is the default; component tests opt in to jsdom via @vitest-environment docblock.
    // Keeping node as default preserves Web Crypto availability for jose-based auth tests.
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    exclude: ["node_modules", "test/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/**/*.ts", "lib/**/*.tsx"],
      exclude: ["lib/dicom/**", "lib/empty-module.js"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
