import type { MetadataRoute } from "next";

type LahooniManifest = MetadataRoute.Manifest & {
  launch_handler: {
    client_mode: "navigate-existing";
  };
};

export default function manifest(): LahooniManifest {
  return {
    id: "/",
    name: "بوابة أستاذ لحوني التعليمية",
    short_name: "أستاذ لحوني",
    description: "منصة تعليمية ذكية للمعلم والطالب وولي الأمر",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    launch_handler: {
      client_mode: "navigate-existing",
    },
    orientation: "any",
    background_color: "#07152f",
    theme_color: "#0b1d48",
    lang: "ar",
    dir: "rtl",
    categories: ["education", "productivity"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/ostadh-lahooni-192.jpg", sizes: "192x192", type: "image/jpeg", purpose: "any" },
      { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
