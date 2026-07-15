import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name} — ${SITE.tagline}`,
    short_name: SITE.name,
    description:
      "Ứng dụng theo dõi hành trình lớn lên của bé: bú, ngủ, bỉm, sức khoẻ và tuần phát triển.",
    start_url: "/",
    display: "standalone",
    background_color: "#fdf8f4",
    theme_color: "#f08f8c",
    lang: "vi",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Maskable so Android can crop it to any shape without clipping the mark.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
