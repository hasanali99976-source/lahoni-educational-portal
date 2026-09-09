"use client";

import { useEffect } from "react";

function isDownloadButton(target: EventTarget | null) {
  const element = target instanceof Element ? target.closest("button") : null;
  if (!element) return null;
  return /تحميل\s*PDF/.test(element.textContent || "") ? element as HTMLButtonElement : null;
}

async function downloadReport(button: HTMLButtonElement) {
  const report = button.closest(".daily-attendance-v300") as HTMLElement | null;
  if (!report || button.dataset.pdfBusy === "1") return;
  button.dataset.pdfBusy = "1";
  const originalText = button.textContent || "تحميل PDF مباشرة";
  button.textContent = "جاري إنشاء PDF...";
  button.disabled = true;

  let clone: HTMLElement | null = null;
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    clone = report.cloneNode(true) as HTMLElement;
    clone.classList.add("pdf-export-mode");
    clone.querySelectorAll(".no-pdf, button, select, input").forEach(node => node.remove());
    clone.style.position = "fixed";
    clone.style.left = "-20000px";
    clone.style.top = "0";
    clone.style.width = "1120px";
    clone.style.maxWidth = "1120px";
    clone.style.background = "#f5f8f8";
    clone.style.padding = "24px";
    clone.style.direction = "rtl";
    document.body.appendChild(clone);

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = await html2canvas(clone, {
      scale: window.innerWidth < 700 ? 1.15 : 1.5,
      useCORS: true,
      backgroundColor: "#f5f8f8",
      logging: false,
      windowWidth: 1180,
    });

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    const pageW = 297;
    const pageH = 210;
    const margin = 8;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2;
    const imageHeight = canvas.height * usableW / canvas.width;
    const image = canvas.toDataURL("image/jpeg", 0.9);

    let offset = 0;
    let page = 0;
    while (offset < imageHeight - 0.5) {
      if (page > 0) pdf.addPage("a4", "landscape");
      pdf.addImage(image, "JPEG", margin, margin - offset, usableW, imageHeight, undefined, "FAST");
      offset += usableH;
      page += 1;
    }

    const subject = (report.querySelector(".dav300-head-badge span")?.textContent || "المادة").trim();
    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير-الانضباط-${subject}.pdf`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 60000);

    setTimeout(() => {
      if (document.visibilityState === "visible" && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }, 350);
  } catch (error) {
    console.error("discipline PDF download failed", error);
    alert("تعذر تحميل تقرير الانضباط بصيغة PDF. حاول مرة أخرى بعد لحظات.");
  } finally {
    clone?.remove();
    button.dataset.pdfBusy = "0";
    button.disabled = false;
    button.textContent = originalText;
  }
}

export default function DisciplineDownloadV2() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const button = isDownloadButton(event.target);
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void downloadReport(button);
    };

    window.addEventListener("click", handleClick, true);
    return () => window.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
