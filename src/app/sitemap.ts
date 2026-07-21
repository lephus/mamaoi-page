import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: { path: string; priority: number }[] = [
    // The event is the homepage; the app intro lives at /ung-dung. /su-kien is
    // a permanent redirect, so it is intentionally left out of the sitemap.
    { path: "", priority: 1 },
    { path: "/ung-dung", priority: 0.8 },
    { path: "/privacy-policy", priority: 0.5 },
    { path: "/terms-conditions", priority: 0.5 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${SITE.url}${path}`,
    changeFrequency: "weekly",
    priority,
  }));
}
