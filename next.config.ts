import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory makes Next.js guess the wrong
  // workspace root. Pin it to this project.
  turbopack: {
    root: path.resolve(),
  },

  // TẠM ẨN TRANG CHỦ (landing page của app).
  // Trang `/` vẫn còn nguyên ở src/app/page.tsx, chỉ là chưa cho truy cập.
  // Để mở lại trang chủ: xoá cả khối `redirects()` này và trả mục `{ path: "", priority: 1 }`
  // về src/app/sitemap.ts.
  async redirects() {
    return [
      {
        source: "/",
        destination: "/su-kien",
        // 307, không phải 308: trình duyệt cache 308 vĩnh viễn, nên khi mở lại
        // trang chủ thì những người đã từng vào `/` vẫn sẽ bị đá sang /su-kien.
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
