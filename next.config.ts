import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  compress: true,
  reactStrictMode: true,
  // Run lint as a separate CI step (`npm run lint`) so a stylistic regression
  // doesn't block a deploy. Type errors still fail the build.
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "framer-motion",
      "firebase",
      "firebase/firestore",
      "firebase/auth",
      "firebase/storage",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
    ],
  },
  // Allow caching of the service worker but force revalidation so updates land
  // quickly. /sw.js is always fetched fresh; static assets get long-lived
  // immutable caching.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, must-revalidate" },
        ],
      },
    ];
  },
};

// Sentry wraps the Next config to:
//  - upload source maps at build time (un-minified stack traces in Sentry)
//  - route the /monitoring path to Sentry's CDN so ad blockers don't drop reports
//  - hide source maps from the public bundle
// All of this is a no-op when SENTRY_AUTH_TOKEN is missing (e.g. local dev),
// so the build keeps working without an account.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Silence the "no auth token" warning when running outside CI.
  silent: !process.env.CI,
  // Use a tunnel so corporate networks / ad blockers don't drop events.
  tunnelRoute: "/monitoring",
  // Hide source maps from the public bundle (don't ship them with the JS).
  sourcemaps: {
    disable: false,
    deleteSourcemapsAfterUpload: true,
  },
  // Tree-shake out the Sentry logger in production.
  disableLogger: true,
});
