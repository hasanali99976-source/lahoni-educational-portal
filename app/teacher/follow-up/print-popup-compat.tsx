"use client";

import { useEffect } from "react";

/**
 * Safari وبعض إصدارات Chrome قد تعيد null عند تمرير noopener ضمن خصائص window.open.
 * صفحة الإتقان تعزل النافذة بعد فتحها، لذلك ننظف الخصائص أولًا ثم نقطع opener يدويًا.
 */
export default function PrintPopupCompat() {
  useEffect(() => {
    const originalOpen = window.open.bind(window);
    const compatibleOpen: typeof window.open = (url, target, features) => {
      const featureText = features || "";
      const isPrintableBlank = (url === "" || url === undefined) && featureText.includes("noopener");
      if (!isPrintableBlank) return originalOpen(url, target, features);

      const cleanedFeatures = featureText
        .split(",")
        .map(value => value.trim())
        .filter(value => value && value !== "noopener" && value !== "noreferrer")
        .join(",");
      const popup = originalOpen(url, target === "_blank" ? "lahooni-follow-print" : target, cleanedFeatures);
      if (popup) {
        try { popup.opener = null; } catch {}
      }
      return popup;
    };

    window.open = compatibleOpen;
    return () => { window.open = originalOpen as typeof window.open; };
  }, []);

  return null;
}
