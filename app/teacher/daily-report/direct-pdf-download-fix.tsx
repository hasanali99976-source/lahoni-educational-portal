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
      const page = button.closest(".daily-report-page") as HTMLElement | null;
      if (!report || !page) return;

      busy = true;
      const originalText = button.textContent || "تحميل PDF مباشرة";
      button.disabled = true;
      button.textContent = "جاري تجهيز PDF...";

      let host: HTMLDivElement | null = null;
      try {
        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import("html2canvas"),
          import("jspdf"),
        ]);

        host = document.createElement("div");
        host.style.position = "fixed";
        host.style.right = "-30000px";
        host.style.top = "0";
        host.style.width = "1380px";
        host.style.background = "#f5f8f8";
        host.style.padding = "28px";
        host.style.direction = "rtl";

        const clone = page.cloneNode(true) as HTMLElement;
        clone.classList.add("pdf-export-mode");
        clone.style.width = "100%";
        clone.style.maxWidth = "none";
        clone.style.background = "#f5f8f8";
        clone.style.gap = "12px";

        clone.querySelectorAll(".no-pdf,.dr-actions").forEach(el => el.remove());

        const brand = document.createElement("section");
        brand.className = "pdf-brand-header";
        const teacher = clone.querySelector(".dr-footer span:first-child")?.textContent?.replace(/^المعلم:\s*/, "") || "—";
        const subject = clone.querySelector(".dav300-head-badge span")?.textContent || "المادة";
        const scope = clone.querySelector(".rank-scope")?.textContent || "جميع الفصول";
        brand.innerHTML = `
          <div class="pdf-brand-title">بوابة أستاذ لحوني التعليمية</div>
          <div class="pdf-brand-subtitle">تقرير سجل الحضور والانضباط</div>
          <div class="pdf-brand-meta"><span>المعلم: <b>${teacher}</b></span><span>المادة: <b>${subject}</b></span><span>النطاق: <b>${scope}</b></span></div>
        `;
        clone.prepend(brand);

        const footer = document.createElement("div");
        footer.className = "pdf-brand-footer";
        footer.textContent = "بوابة أستاذ لحوني التعليمية • تقرير الانضباط";
        clone.appendChild(footer);

        const style = document.createElement("style");
        style.textContent = `
          .pdf-brand-header{background:linear-gradient(135deg,#073f4d,#0b756e);color:#fff;border-radius:18px;padding:18px 22px;text-align:center;margin-bottom:4px}
          .pdf-brand-title{font-size:26px;font-weight:950;letter-spacing:.1px}.pdf-brand-subtitle{font-size:15px;font-weight:850;margin-top:4px;color:#eaf8f6}
          .pdf-brand-meta{display:flex;justify-content:center;gap:26px;flex-wrap:wrap;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.18);font-size:12px}
          .pdf-brand-footer{text-align:center;padding:10px 0 2px;color:#557078;font-size:10px;font-weight:850;border-top:1px solid #d8e4e2;margin-top:8px}
          .pdf-export-mode .dr-head{padding:14px 18px;border-radius:15px;box-shadow:none}.pdf-export-mode .dr-head h1{font-size:22px}.pdf-export-mode .dr-head p{font-size:10px}
          .pdf-export-mode .dav300-head{padding:14px 18px;border-radius:15px;box-shadow:none}.pdf-export-mode .dav300-head h2{font-size:20px}.pdf-export-mode .dav300-head p{font-size:10px}
          .pdf-export-mode .dav300-kpis{grid-template-columns:repeat(5,1fr)!important;gap:7px}.pdf-export-mode .dav300-kpis article{padding:10px 11px;border-radius:13px;box-shadow:none}
          .pdf-export-mode .dav300-ranking{padding:12px;border-radius:14px;box-shadow:none}.pdf-export-mode .dav300-ranking table{width:100%;border-collapse:collapse}
          .pdf-export-mode .dav300-table{overflow:visible!important;border-radius:14px;box-shadow:none}.pdf-export-mode .dav300-table table{min-width:0!important;width:100%;table-layout:fixed}
          .pdf-export-mode .dav300-table th,.pdf-export-mode .dav300-table td{font-size:9px!important;padding:7px 6px!important;line-height:1.45!important;white-space:normal!important;word-break:normal!important;vertical-align:middle!important}
          .pdf-export-mode .dav300-table td.name{font-size:9.5px!important}.pdf-export-mode .dav300-formula{font-size:8.5px;padding:9px 11px;box-shadow:none}
          .pdf-export-mode .dr-footer{font-size:8.5px;padding:7px 2px}.pdf-export-mode *{box-sizing:border-box}
          .pdf-export-mode tr,.pdf-export-mode .dav300-rank-group,.pdf-export-mode .dav300-kpis article{break-inside:avoid;page-break-inside:avoid}
        `;
        clone.appendChild(style);
        host.appendChild(clone);
        document.body.appendChild(host);

        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        const canvas = await html2canvas(clone, {
          scale: 1.55,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#f5f8f8",
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 1380,
        });

        const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
        const pageW = 297;
        const pageH = 210;
        const margin = 7;
        const usableW = pageW - margin * 2;
        const usableH = pageH - margin * 2;
        const pxPerMm = canvas.width / usableW;
        const maxPagePxH = Math.max(1, Math.floor(usableH * pxPerMm));
        const cloneRect = clone.getBoundingClientRect();
        const scaleY = canvas.height / cloneRect.height;

        const safeBreaks = new Set<number>([0, canvas.height]);
        clone.querySelectorAll("tr,.dav300-rank-group,.dav300-kpis,.dr-head,.dav300-head,.dav300-formula,.dr-footer,.pdf-brand-header,.pdf-brand-footer").forEach(el => {
          const rect = (el as HTMLElement).getBoundingClientRect();
          const bottom = Math.round((rect.bottom - cloneRect.top) * scaleY);
          if (bottom > 0 && bottom < canvas.height) safeBreaks.add(bottom);
        });
        const breaks = [...safeBreaks].sort((a, b) => a - b);

        let offset = 0;
        let pageNo = 0;
        while (offset < canvas.height - 2) {
          const idealEnd = Math.min(canvas.height, offset + maxPagePxH);
          let end = idealEnd;
          if (idealEnd < canvas.height) {
            const candidates = breaks.filter(v => v > offset + Math.min(180, maxPagePxH * 0.35) && v <= idealEnd);
            if (candidates.length) end = candidates[candidates.length - 1];
          }
          if (end <= offset) end = Math.min(canvas.height, offset + maxPagePxH);

          const sliceH = end - offset;
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = sliceH;
          const ctx = slice.getContext("2d");
          if (!ctx) throw new Error("canvas_context_failed");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

          if (pageNo > 0) pdf.addPage("a4", "landscape");
          const sliceMmH = sliceH / pxPerMm;
          pdf.addImage(slice.toDataURL("image/jpeg", 0.94), "JPEG", margin, margin, usableW, sliceMmH, undefined, "FAST");
          pdf.setFontSize(7.5);
          pdf.setTextColor(100, 120, 125);
          pdf.text(`صفحة ${pageNo + 1}`, pageW / 2, pageH - 2.5, { align: "center" });

          offset = end;
          pageNo += 1;
        }

        const heading = report.querySelector(".dav300-head h2")?.textContent || "تقرير الانضباط";
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
        host?.remove();
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
