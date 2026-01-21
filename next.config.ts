import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for FFmpeg.wasm SharedArrayBuffer support
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
  // Turbopack config (Next.js 16+)
  turbopack: {
    resolveAlias: {
      fs: { browser: './empty-module.js' },
    },
  },
  // Webpack fallback for non-Turbopack builds
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

export default nextConfig;
