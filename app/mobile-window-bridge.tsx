"use client";

import { useEffect } from "react";

type OstadhNativeBridge = {
  saveBase64?: (fileName: string, mimeType: string, base64Data: string) => void;
  printPage?: (title: string) => void;
};

declare global {
  interface Window {
    OstadhApp?: OstadhNativeBridge;
    __OSTADH_ANDROID__?: boolean;
    ostadhNativePrint?: (title?: string) => boolean;
  }
}

function dataUrlOf(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("read_failed"));
    reader.readAsDataURL(blob);
  });
}

export default function MobileWindowBridge() {
  useEffect(() => {
    const isAndroidApp = /OstadhLahooniAndroid/i.test(navigator.userAgent) || Boolean(window.__OSTADH_ANDROID__);
    if (!isAndroidApp) return;

    document.documentElement.classList.add("ostadh-android-app");
    const originalOpen = window.open;
    const popupHosts = new Set<HTMLDivElement>();

    const closeHost = (host: HTMLDivElement) => {
      popupHosts.delete(host);
      host.remove();
      if (!popupHosts.size) document.body.classList.remove("native-popup-open");
    };

    window.open = ((url?: string | URL, _target?: string, _features?: string) => {
      const requested = String(url || "").trim();
      if (requested && requested !== "about:blank") {
        window.location.assign(requested);
        return window;
      }

      const host = document.createElement("div");
      host.className = "native-popup-overlay";
      host.dir = "rtl";

      const toolbar = document.createElement("div");
      toolbar.className = "native-popup-toolbar";
      const title = document.createElement("strong");
      title.textContent = "عرض التقرير";
      const close = document.createElement("button");
      close.type = "button";
      close.className = "native-popup-close";
      close.textContent = "إغلاق";
      close.addEventListener("click", () => closeHost(host));
      toolbar.append(title, close);

      const frame = document.createElement("iframe");
      frame.className = "native-popup-frame";
      frame.title = "التقرير";
      frame.src = "about:blank";
      host.append(toolbar, frame);
      document.body.append(host);
      document.body.classList.add("native-popup-open");
      popupHosts.add(host);

      const frameWindow = frame.contentWindow;
      if (!frameWindow) {
        closeHost(host);
        return null;
      }

      try {
        Object.defineProperty(frameWindow, "close", { configurable: true, value: () => closeHost(host) });
        Object.defineProperty(frameWindow, "print", {
          configurable: true,
          value: () => {
            const reportTitle = frameWindow.document.title || "تقرير أستاذ لحوني";
            if (window.ostadhNativePrint) window.ostadhNativePrint(reportTitle);
            else window.OstadhApp?.printPage?.(reportTitle);
          },
        });
      } catch {
        // يبقى التقرير ظاهرًا حتى لو منع WebView تعديل الدوال.
      }

      return frameWindow;
    }) as typeof window.open;

    const handleBlobDownload = async (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[download]") as HTMLAnchorElement | null;
      if (!anchor || !anchor.href.startsWith("blob:") || !window.OstadhApp?.saveBase64) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        const blob = await fetch(anchor.href).then(response => response.blob());
        const dataUrl = await dataUrlOf(blob);
        const base64Data = dataUrl.split(",", 2)[1] || "";
        const fileName = anchor.download || `ostadh-lahooni-${Date.now()}`;
        window.OstadhApp.saveBase64(fileName, blob.type || "application/octet-stream", base64Data);
      } catch {
        window.alert("تعذر حفظ الملف داخل التطبيق. حاول مرة أخرى.");
      }
    };

    document.addEventListener("click", handleBlobDownload, true);

    return () => {
      window.open = originalOpen;
      document.removeEventListener("click", handleBlobDownload, true);
      popupHosts.forEach(host => host.remove());
      document.body.classList.remove("native-popup-open");
      document.documentElement.classList.remove("ostadh-android-app");
    };
  }, []);

  return null;
}
