import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // YouTube refuses embeds that arrive without a referrer (player error 153)
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] }];
  },
};

export default nextConfig;
