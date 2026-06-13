import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "mediasoup"];
    }
    return config;
  },
};

export default nextConfig;
