"use client";

import { useEffect } from "react";

const CURRENT_CACHE = "ostadh-lahooni-v125-stable";
const SERVICE_WORKER_VERSION = "125-stable";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter(key => key.startsWith("ostadh-lahooni-") && key !== CURRENT_CACHE)
            .map(key => caches.delete(key)),
        );
        await navigator.serviceWorker.register(`/sw.js?v=${SERVICE_WORKER_VERSION}`, {
          scope: "/",
          updateViaCache: "none",
        });
      } catch {
        // تبقى المنصة متاحة حتى لو تعذر تشغيل وضع التطبيق.
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
