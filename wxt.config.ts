import { defineConfig } from "wxt";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const navioSdkVersion = require("./node_modules/navio-sdk/package.json").version;
const appVersion = require("./package.json").version;

// Browser extension build (MetaMask-style provider injection: window.navio).
// Reuses the same Vue app (src/) as the popup UI, and the same wasm/polyfill
// setup as vite.config.js since the wallet crypto (navio-sdk / navio-blsct)
// needs to run inside the popup page too.
export default defineConfig({
  // WXT always aliases "@" to srcDir, so srcDir is set to src/ to match the
  // "@" convention already used throughout the app (see vite.config.js).
  // entrypoints/ and public/ stay at the project root (resolved as absolute
  // paths below), they don't need to live inside src/.
  srcDir: resolve(__dirname, "src"),
  entrypointsDir: resolve(__dirname, "entrypoints"),
  outDir: "dist-extension",
  manifestVersion: 3,
  manifest: {
    name: "Navio Go Wallet",
    description: "Navio Go Wallet - browser extension",
    permissions: ["storage"],
    // MV3's default CSP ("script-src 'self'") blocks WebAssembly compilation.
    // The popup runs navio-blsct's wasm module, so 'wasm-unsafe-eval' must be
    // explicitly allowed for extension pages.
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    icons: {
      48: "icons/icon-48.webp",
      96: "icons/icon-96.webp",
      128: "icons/icon-128.webp",
    },
    action: {
      default_icon: {
        48: "icons/icon-48.webp",
        96: "icons/icon-96.webp",
      },
    },
  },
  vite: () => ({
    plugins: [
      vue(),
      tailwindcss(),
      wasm(),
      topLevelAwait(),
      nodePolyfills({
        include: ["crypto", "buffer", "process", "stream"],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    resolve: {
      alias: [
        {
          find: "navio-blsct/wasm",
          replacement: resolve(__dirname, "node_modules/navio-blsct/wasm"),
        },
      ],
    },
    optimizeDeps: {
      include: ["sql.js", "buffer", "@noble/hashes/sha256", "@noble/hashes/ripemd160"],
      exclude: ["navio-sdk", "navio-blsct"],
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
        supported: {
          "dynamic-import": true,
        },
      },
    },
    define: {
      global: "globalThis",
      __APP_VERSION__: JSON.stringify(appVersion),
      __SDK_VERSION__: JSON.stringify(navioSdkVersion),
    },
    assetsInclude: ["**/*.wasm"],
    build: {
      target: "esnext",
    },
  }),
});
