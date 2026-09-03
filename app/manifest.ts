import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "بوابة أستاذ لحوني التعليمية",
    short_name: "أستاذ لحوني",
    description: "منصة تعليمية متكاملة لإدارة التعلم والمتابعة",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#f7f3ea",
    theme_color: "#102f50",
    lang: "ar",
    dir: "rtl",
    categories: ["education", "productivity"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/ostadh-lahooni-192.jpg", sizes: "192x192", type: "image/jpeg", purpose: "any" },
      { src: "/icons/ostadh-lahooni-192.jpg", sizes: "192x192", type: "image/jpeg", purpose: "maskable" },
    ],
  };
}
