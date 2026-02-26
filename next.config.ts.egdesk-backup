import type { NextConfig } from "next";

console.log('🔍 DEBUG next.config: EGDESK_BASE_PATH env var =', process.env.EGDESK_BASE_PATH);

const nextConfig: NextConfig = {
  basePath: process.env.EGDESK_BASE_PATH || '',
  assetPrefix: process.env.EGDESK_BASE_PATH || '',
  /* config options here */
};

console.log('🔍 DEBUG next.config: Final config basePath =', nextConfig.basePath);
console.log('🔍 DEBUG next.config: Final config assetPrefix =', nextConfig.assetPrefix);


export default nextConfig;
