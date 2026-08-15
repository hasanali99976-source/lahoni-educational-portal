import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "أستاذ لحوني",
    short_name: "أستاذ لحوني",
    description: "سجل المتابعة والتقارير المدرسية",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#071a33",
    theme_color: "#071a33",
    lang: "ar",
    dir: "rtl",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icons/ostadh-lahooni-192.jpg",
        sizes: "192x192",
        type: "image/jpeg",
        purpose: "any maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };
}
