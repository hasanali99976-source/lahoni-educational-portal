from pathlib import Path

page_path = Path("app/teacher/portfolio/page.tsx")
page = page_path.read_text(encoding="utf-8")

state_anchor = '  const [previewOpen, setPreviewOpen] = useState(false);\n'
if 'const [exportingPdf, setExportingPdf]' not in page:
    if state_anchor not in page:
        raise SystemExit("preview state anchor not found")
    page = page.replace(
        state_anchor,
        state_anchor + '  const [exportingPdf, setExportingPdf] = useState(false);\n',
        1,
    )

start = page.find('  async function printPortfolio() {')
end = page.find('\n\n  return (', start)
if start < 0 or end < 0:
    raise SystemExit("printPortfolio function not found")

new_function = r'''  async function printPortfolio() {
    if (!achievements.length) {
      setMessage("أضف إنجازًا واحدًا على الأقل، ثم أخرج ملف الإنجاز.");
      return;
    }
    if (exportingPdf) return;

    const pages = Array.from(document.querySelectorAll<HTMLElement>("#portfolio-print-preview .print-page"));
    if (!pages.length) {
      setMessage("تعذر العثور على صفحات ملف الإنجاز. أغلق المعاينة وافتحها مرة أخرى.");
      return;
    }

    const nativeWindow = window as typeof window & {
      OstadhApp?: {
        saveBase64?: (fileName: string, mimeType: string, base64Data: string) => void;
        printPage?: (title: string) => void;
      };
      ostadhNativePrint?: (title?: string) => boolean;
      __OSTADH_ANDROID__?: boolean;
    };
    const teacherName = session?.teacherName || "المعلم";
    const safeTeacherName = teacherName.replace(/[\\/:*?"<>|]+/g, "-").trim() || "المعلم";
    const fileName = `ملف-إنجاز-${safeTeacherName}.pdf`;
    const root = document.documentElement;

    setExportingPdf(true);
    root.classList.add("portfolio-pdf-exporting");
    setMessage("جارٍ إنشاء ملف PDF الحقيقي من صفحات الإنجاز...");

    try {
      if ("fonts" in document) {
        await Promise.race([
          document.fonts.ready,
          new Promise<void>((resolve) => window.setTimeout(resolve, 2500)),
        ]);
      }
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
        putOnlyUsedFonts: true,
      });
      const renderScale = Math.min(1.55, Math.max(1.2, window.devicePixelRatio || 1.25));

      for (let index = 0; index < pages.length; index += 1) {
        const pageElement = pages[index];
        setMessage(`جارٍ إنشاء ملف PDF — الصفحة ${arabicNumber(index + 1)} من ${arabicNumber(pages.length)}`);
        if (index > 0) pdf.addPage("a4", "portrait");

        const canvas = await html2canvas(pageElement, {
          backgroundColor: "#ffffff",
          scale: renderScale,
          useCORS: true,
          allowTaint: false,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          width: pageElement.scrollWidth,
          height: pageElement.scrollHeight,
          windowWidth: Math.max(document.documentElement.clientWidth, pageElement.scrollWidth),
          windowHeight: Math.max(document.documentElement.clientHeight, pageElement.scrollHeight),
        });
        const imageData = canvas.toDataURL("image/jpeg", 0.82);
        pdf.addImage(imageData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
        canvas.width = 1;
        canvas.height = 1;
        await new Promise<void>((resolve) => window.setTimeout(resolve, 25));
      }

      if (nativeWindow.OstadhApp?.saveBase64) {
        setMessage("اكتمل إنشاء الملف، جارٍ حفظه في مجلد التنزيلات...");
        const dataUri = pdf.output("datauristring");
        const base64Data = dataUri.includes(",") ? dataUri.slice(dataUri.indexOf(",") + 1) : "";
        if (!base64Data) throw new Error("pdf_base64_empty");
        nativeWindow.OstadhApp.saveBase64(fileName, "application/pdf", base64Data);
        setMessage(`تم إنشاء ${fileName} وحفظه في مجلد التنزيلات.`);
      } else {
        pdf.save(fileName);
        setMessage(`تم إنشاء ${fileName} وبدأ تنزيله.`);
      }
    } catch (error) {
      console.error("portfolio_pdf_export_failed", error);
      try {
        const title = `ملف إنجاز ${teacherName}`;
        if (nativeWindow.OstadhApp?.printPage) {
          nativeWindow.OstadhApp.printPage(title);
          setMessage("تعذر التنزيل المباشر، فُتحت شاشة الطباعة البديلة. اختر الحفظ بصيغة PDF.");
        } else if (typeof nativeWindow.ostadhNativePrint === "function" && nativeWindow.ostadhNativePrint(title) !== false) {
          setMessage("تعذر التنزيل المباشر، فُتحت شاشة الطباعة البديلة. اختر الحفظ بصيغة PDF.");
        } else {
          window.print();
          setMessage("تعذر التنزيل المباشر، فُتحت شاشة الطباعة البديلة. اختر الحفظ بصيغة PDF.");
        }
      } catch {
        setMessage("تعذر إنشاء ملف PDF على هذا الجهاز. أعد فتح المعاينة ثم جرّب مرة أخرى.");
      }
    } finally {
      root.classList.remove("portfolio-pdf-exporting");
      setExportingPdf(false);
    }
  }'''

page = page[:start] + new_function + page[end:]

old_button = '<button type="button" className="preview-print" onClick={printPortfolio}>إخراج النسخة النهائية PDF</button>'
new_button = '''<button type="button" className="preview-print" onClick={printPortfolio} disabled={exportingPdf}>
              {exportingPdf ? "جارٍ إنشاء ملف PDF..." : "تنزيل ملف PDF النهائي"}
            </button>'''
if old_button not in page:
    raise SystemExit("preview PDF button not found")
page = page.replace(old_button, new_button, 1)
page_path.write_text(page, encoding="utf-8")

sw_path = Path("public/sw.js")
sw = sw_path.read_text(encoding="utf-8")
sw = sw.replace("ostadh-lahooni-v50-portfolio-achievement-preview", "ostadh-lahooni-v51-portfolio-direct-pdf")
sw_path.write_text(sw, encoding="utf-8")

pwa_path = Path("app/pwa-register.tsx")
pwa = pwa_path.read_text(encoding="utf-8")
import re
pwa = re.sub(r'const CURRENT_CACHE = "[^"]+";', 'const CURRENT_CACHE = "ostadh-lahooni-v51-portfolio-direct-pdf";', pwa)
pwa = re.sub(r'const RELOAD_KEY = "[^"]+";', 'const RELOAD_KEY = "ostadh-lahooni-v51-portfolio-direct-pdf";', pwa)
pwa = re.sub(r'navigator\.serviceWorker\.register\("/sw\.js\?v=[^"]+"', 'navigator.serviceWorker.register("/sw.js?v=51-portfolio-direct-pdf"', pwa)
pwa_path.write_text(pwa, encoding="utf-8")

print("patched portfolio direct PDF v51")
