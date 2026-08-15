import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "أستاذ لحوني",
    short_name: "أستاذ لحوني",
    description: "سجل المتابعة والتقارير المدرسية",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait-primary",
    background_color: "#071a33",
    theme_color: "#071a33",
    lang: "ar",
    dir: "rtl",
    categories: ["education", "productivity"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/icons/ostadh-lahooni-192.jpg",
        sizes: "192x192",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
