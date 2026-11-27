import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfkit"],
  experimental: { serverActions: { bodySizeLimit: "20mb" } }
};
export default nextConfig;