import { defineConfig } from "vitest/config";
import { resolve } from "path";

// Deliberately not reusing vite.config.js: that config's wasm/top-level-await
// plugins and navio-sdk/navio-blsct optimizeDeps excludes exist to support
// the wallet's browser bundle and aren't needed (or wanted) for unit tests.
export default defineConfig({
  resolve: {
    alias: [{ find: "@", replacement: resolve(__dirname, "src") }],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
    setupFiles: ["./src/lib/payroll/__tests__/setup.js"],
  },
});
