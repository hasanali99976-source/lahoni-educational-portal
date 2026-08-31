from pathlib import Path
import re

page_path = Path("app/teacher/portfolio/page.tsx")
page = page_path.read_text()

anchor = '''  async function saveSettings() {
    await persist(form, "تم حفظ إعدادات ملف الإنجاز");
  }
'''
replacement = '''  async function saveSettings() {
    await persist(form, "تم حفظ إعدادات ملف الإنجاز");
  }

  function printPortfolio() {
    if (!achievements.length) {
      setMessage("أضف إنجازًا واحدًا على الأقل، ثم أخرج ملف الإنجاز.");
      return;
    }

    const nativeWindow = window as typeof window & {
      OstadhApp?: { printPage?: (title: string) => void };
      ostadhNativePrint?: (title?: string) => boolean;
      __OSTADH_ANDROID__?: boolean;
    };
    const previousTitle = document.title;
    const printTitle = `ملف إنجاز ${session?.teacherName || "المعلم"}`;
    const restorePage = () => {
      window.setTimeout(() => {
        document.documentElement.classList.remove("portfolio-print-active");
        document.title = previousTitle;
      }, 1200);
    };

    document.title = printTitle;
    document.documentElement.classList.add("portfolio-print-active");
    setMessage("جارٍ فتح ملف الإنجاز للطباعة أو الحفظ PDF...");

    try {
      if (nativeWindow.OstadhApp?.printPage) {
        nativeWindow.OstadhApp.printPage(printTitle);
        setMessage("تم إرسال ملف الإنجاز إلى شاشة الطباعة.");
        restorePage();
        return;
      }

      if (typeof nativeWindow.ostadhNativePrint === "function") {
        const opened = nativeWindow.ostadhNativePrint(printTitle);
        if (opened !== false) {
          setMessage("تم إرسال ملف الإنجاز إلى شاشة الطباعة.");
          restorePage();
          return;
        }
      }

      window.focus();
      window.print();
      setMessage("تم فتح شاشة الطباعة. اختر الطابعة أو حفظ بصيغة PDF.");
    } catch {
      if (/OstadhLahooniAndroid/i.test(navigator.userAgent) || nativeWindow.__OSTADH_ANDROID__) {
        try {
          window.location.assign(`ostadh://print?title=${encodeURIComponent(printTitle)}`);
          setMessage("تم إرسال أمر الطباعة إلى التطبيق.");
        } catch {
          setMessage("تعذر فتح الطباعة داخل التطبيق. أغلق التطبيق وافتحه ثم جرّب مرة أخرى.");
        }
      } else {
        setMessage("تعذر فتح نافذة الطباعة. افتح البوابة في Chrome ثم أعد المحاولة.");
      }
    } finally {
      restorePage();
    }
  }
'''
if anchor not in page:
    raise SystemExit("save settings anchor not found")
page = page.replace(anchor, replacement, 1)

old_button = '''          <button
            type="button"
            className="print-portfolio-button"
            data-native-print="true"
            disabled={!achievements.length}
            onClick={() => window.print()}
          >
            طباعة ملف الإنجاز كاملًا
          </button>'''
new_button = '''          <button
            type="button"
            className="print-portfolio-button"
            onClick={printPortfolio}
            aria-label="إخراج ملف الإنجاز للطباعة أو الحفظ بصيغة PDF"
          >
            إخراج ملف الإنجاز PDF
          </button>'''
if old_button not in page:
    raise SystemExit("print button anchor not found")
page = page.replace(old_button, new_button, 1)
page_path.write_text(page)

sw_path = Path("public/sw.js")
sw = sw_path.read_text()
sw, count = re.subn(
    r'const CACHE_NAME = "[^"]+";',
    'const CACHE_NAME = "ostadh-lahooni-v49-portfolio-print-command";',
    sw,
    count=1,
)
if count != 1:
    raise SystemExit("service worker cache name not found")
sw_path.write_text(sw)
