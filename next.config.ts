import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  devIndicators: false,
  // Replit's preview runs on a *.replit.dev domain, not localhost. Next.js
  // blocks dev-only requests (e.g. hot reload) from unknown origins, so allow it.
  // Only affects `npm run dev`; production builds ignore this setting.
  allowedDevOrigins: ["**.replit.dev"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
