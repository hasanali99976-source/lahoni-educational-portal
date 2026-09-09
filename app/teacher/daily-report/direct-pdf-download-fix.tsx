"use client";

import { useEffect } from "react";

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 90);
}

export default function DirectPdfDownloadFix() {
  useEffect(() => {
    let busy = false;

    const handler = async (event: Event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button") as HTMLButtonElement | null;
      if (!button || !button.textContent?.includes("PDF") || !button.closest(".daily-attendance-v300")) return;

      event.preventDefault();
      event.stopPropagation();
      (event as any).stopImmediatePropagation?.();
      if (busy) return;

      const report = button.closest(".daily-attendance-v300") as HTMLElement | null;
      if (!report) return;

      busy = true;
      const originalText = button.textContent || "تحميل PDF مباشرة";
      button.disabled = true;
      button.textContent = "جاري تجهيز PDF...";
      report.classList.add("pdf-export-mode");

      try {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import("html2canvas"),
          import("jspdf"),
        ]);

        const canvas = await html2canvas(report, {
          scale: Math.min(2, Math.max(1.35, window.devicePixelRatio || 1)),
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#f5f8f8",
          logging: false,
          scrollX: 0,
          scrollY: -window.scrollY,
          windowWidth: Math.max(report.scrollWidth, 1180),
        });

        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
        const pageW = 297;
        const pageH = 210;
        const margin = 7;
        const usableW = pageW - margin * 2;
        const usableH = pageH - margin * 2;
        const pxPerMm = canvas.width / usableW;
        const pagePxH = Math.max(1, Math.floor(usableH * pxPerMm));

        let offset = 0;
        let page = 0;
        while (offset < canvas.height) {
          const sliceH = Math.min(pagePxH, canvas.height - offset);
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = sliceH;
          const ctx = slice.getContext("2d");
          if (!ctx) throw new Error("canvas_context_failed");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          if (page > 0) pdf.addPage("a4", "landscape");
          const sliceMmH = sliceH / pxPerMm;
          pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, usableW, sliceMmH, undefined, "FAST");
          offset += sliceH;
          page += 1;
        }

        const heading = report.querySelector(".dav300-head h2")?.textContent || "تقرير الانضباط";
        const subject = report.querySelector(".dav300-head-badge span")?.textContent || "المادة";
        const filename = safeName(`${heading}-${subject}.pdf`);
        const blob = pdf.output("blob");
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 15000);
      } catch (error) {
        console.error("discipline_pdf_download_failed", error);
        window.alert("تعذر تحميل ملف PDF الآن. جرّب مرة أخرى بعد تحديث الصفحة.");
      } finally {
        report.classList.remove("pdf-export-mode");
        button.disabled = false;
        button.textContent = originalText;
        busy = false;
      }
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return null;
}
