import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  experimental:{
    browserDebugInfoInTerminal:true
  },

  serverExternalPackages: ['@remotion/renderer', '@remotion/bundler'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'https',
        hostname: '*.giphy.com',
      },
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
      },
    ],
    localPatterns: [
      {
        pathname: '/api/proxy-image**',
        search: '**',
      },
      {
        pathname: '**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push(
        "@remotion/compositor-darwin-arm64",
        "@remotion/compositor-darwin-x64",
        "@remotion/compositor-linux-arm64-gnu",
        "@remotion/compositor-linux-arm64-musl",
        "@remotion/compositor-linux-x64-gnu",
        "@remotion/compositor-linux-x64-musl",
        "@remotion/compositor-win32-x64-msvc",
        "esbuild"
      );
    }
    return config;
  },
};

export default nextConfig;
