import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/teacher", "/student", "/parent", "/family"],
    },
    host: "https://tahdheeb-history.vercel.app",
  };
}
