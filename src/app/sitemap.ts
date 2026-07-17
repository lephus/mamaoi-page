import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: { path: string; priority: number }[] = [
    // Trang chủ `/` tạm bị ẩn (xem redirects() trong next.config.ts) nên không
    // khai báo ở đây — sitemap không được trỏ tới URL chỉ trả về redirect.
    { path: "/su-kien", priority: 1 },
    { path: "/privacy-policy", priority: 0.5 },
    { path: "/terms-conditions", priority: 0.5 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${SITE.url}${path}`,
    changeFrequency: "weekly",
    priority,
  }));
}
