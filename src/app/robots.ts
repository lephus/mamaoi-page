import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The thank-you page and API have nothing to index and shouldn't be
      // reachable from search.
      disallow: ["/cam-on", "/api/"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
