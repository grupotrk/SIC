/** @type {import('next').NextConfig} */
import path from 'node:path';


const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(process.cwd()),
  // Forzar uso de Webpack en vez de Turbopack
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;

