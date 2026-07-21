import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory makes Next.js guess the wrong
  // workspace root. Pin it to this project.
  turbopack: {
    root: path.resolve(),
  },

  // The event page moved to the root; /su-kien was the old URL (still shared on
  // Facebook and indexed). A permanent (308) redirect hands its SEO to "/".
  async redirects() {
    return [{ source: "/su-kien", destination: "/", permanent: true }];
  },
};

export default nextConfig;
