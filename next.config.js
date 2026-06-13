/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "mediasoup"];
    }
    return config;
  },
};

module.exports = nextConfig;
