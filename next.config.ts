import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a minimal, self-contained server bundle (.next/standalone) that
  // the Docker runner stage copies — avoids shipping the full node_modules
  // tree into the production image. See Dockerfile.
  output: "standalone",
};

export default nextConfig;
