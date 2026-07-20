import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory makes Next.js guess the wrong
  // workspace root. Pin it to this project.
  turbopack: {
    root: path.resolve(),
  },

};

export default nextConfig;
