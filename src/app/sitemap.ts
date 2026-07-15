import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/su-kien", priority: 0.9 },
    { path: "/privacy-policy", priority: 0.5 },
    { path: "/terms-conditions", priority: 0.5 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${SITE.url}${path}`,
    changeFrequency: "weekly",
    priority,
  }));
}
