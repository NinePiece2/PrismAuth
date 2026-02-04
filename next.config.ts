import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Prisma WebAssembly support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    config.output.webassemblyModuleFilename = isServer
      ? "../static/wasm/[modulehash].wasm"
      : "static/wasm/[modulehash].wasm";

    // Ensure native modules like pg are not bundled
    if (isServer) {
      config.externals = [...(config.externals || []), "pg"];
    }

    return config;
  },
};

export default nextConfig;
