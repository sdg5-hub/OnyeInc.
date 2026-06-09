import type { NextConfig } from "next";
import path from "path";

// Cornerstone3D's Emscripten WASM codec packages contain a Node.js code path
// that calls require('fs') inside `if (ENVIRONMENT_IS_NODE)`. That branch is
// dead code in every browser build, but Turbopack/webpack still try to resolve
// the require() during static analysis, which fails on a browser target.
//
// Fix: alias 'fs' to an empty module for browser (client) builds only.
// `serverExternalPackages` additionally stops the SSR/Node.js build from
// bundling these packages at all — they are loaded at runtime via require().
const CORNERSTONE_PACKAGES = [
  "@cornerstonejs/core",
  "@cornerstonejs/tools",
  "@cornerstonejs/dicom-image-loader",
  "@cornerstonejs/codec-charls",
  "@cornerstonejs/codec-libjpeg-turbo-8bit",
  "@cornerstonejs/codec-openjpeg",
];

// Absolute path for webpack (resolve.alias requires absolute paths).
const EMPTY_MODULE_ABS = path.resolve(process.cwd(), "lib/empty-module.js");

const nextConfig: NextConfig = {
  serverExternalPackages: CORNERSTONE_PACKAGES,

  // Turbopack alias (used by `next dev --turbopack` and `next build --turbopack`).
  // Turbopack requires a project-root-relative string, NOT an absolute path.
  // The { browser: ... } form applies only to client bundles; SSR keeps real 'fs'.
  turbopack: {
    resolveAlias: {
      fs: { browser: "./lib/empty-module.js" },
      path: { browser: "./lib/empty-module.js" },
    },
  },

  // Webpack alias — kept as fallback if the --turbopack flag is ever removed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack(config: any, { isServer }: { isServer: boolean }) {
    if (!isServer) {
      config.resolve ??= {};
      config.resolve.alias = {
        ...config.resolve.alias,
        fs: EMPTY_MODULE_ABS,
        path: EMPTY_MODULE_ABS,
      };
    }
    return config;
  },

  // Emits a minimal, self-contained server bundle (.next/standalone) that
  // the Docker runner stage copies — avoids shipping the full node_modules
  // tree into the production image. See Dockerfile.
  output: "standalone",

  // Cornerstone3D's WASM codecs run in a Web Worker and require
  // SharedArrayBuffer, which browsers gate behind these two headers.
  // Scoped to /dicom-viewer only — applying them globally would block
  // cross-origin resources (e.g. third-party iframes) on other routes.
  async headers() {
    return [
      {
        source: "/dicom-viewer/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
