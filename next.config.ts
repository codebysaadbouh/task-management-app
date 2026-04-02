import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mysql2", "bcryptjs", "@auth/drizzle-adapter"],
};

export default nextConfig;
