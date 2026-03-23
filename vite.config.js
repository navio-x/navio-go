import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { VitePWA } from "vite-plugin-pwa";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const navioSdkVersion = require("./node_modules/navio-sdk/package.json").version;
const appVersion = require("./package.json").version;

export default defineConfig({
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
    ...(process.env.VITE_BUILD_TARGET === "web" ? [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        manifest: false,
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
          globIgnores: ["**/*.wasm"],
          navigateFallback: "/wallet/index.html",
          navigateFallbackDenylist: [/^\/wallet\/api/],
          runtimeCaching: [
            {
              urlPattern: /\.wasm$/,
              handler: "NetworkFirst",
              options: {
                cacheName: "wasm-cache",
              },
            },
          ],
        },
      }),
    ] : []),
  ],
  resolve: {
    alias: [
      { find: "@", replacement: "/src" },
      { 
        find: 'navio-blsct/wasm', 
        replacement: resolve(__dirname, 'node_modules/navio-blsct/wasm') 
      },
    ]
  },
  optimizeDeps: {
    include: ['sql.js', 'buffer', '@noble/hashes/sha256', '@noble/hashes/ripemd160'],
    exclude: ["navio-sdk", "navio-blsct"],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      },
      supported: {
        'dynamic-import': true,
      },
    },
  },
  define: {
    global: "globalThis",
    "process.env": {},
    __APP_VERSION__: JSON.stringify(appVersion),
    __SDK_VERSION__: JSON.stringify(navioSdkVersion),
  },
  assetsInclude: ["**/*.wasm"],
  base: process.env.VITE_BUILD_TARGET === "web" ? "/wallet/" : "/",
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: {
          'navio': ['navio-sdk'],
        }
      }
    }
  },
  publicDir: 'public',
  server: {
    fs: {
      allow: [
        resolve(__dirname, ".."),
        resolve(__dirname, "node_modules"),
        resolve(__dirname, "node_modules/navio-blsct"),
        resolve(__dirname, "../../../libblsct-bindings"),
      ],
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },
});