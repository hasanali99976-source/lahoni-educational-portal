from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding="utf-8")


def replace_required(path: str, old: str, new: str) -> None:
    content = read(path)
    if old not in content:
        raise RuntimeError(f"Expected block not found in {path}: {old[:90]!r}")
    write(path, content.replace(old, new, 1))


# 1) Portfolio: cloud is authoritative and updates both web and Android in real time.
page_path = "app/teacher/portfolio/page.tsx"
replace_required(
    page_path,
    'import { doc, getDoc, setDoc } from "firebase/firestore";',
    'import { doc, onSnapshot, setDoc } from "firebase/firestore";',
)
replace_required(
    page_path,
    "  evidence: Evidence[];\n};",
    "  evidence: Evidence[];\n  updatedAt?: string;\n};",
)
replace_required(
    page_path,
    '''function mergeEvidence(cloud: Evidence[], local: Evidence[]) {
  const map = new Map<string, Evidence>();
  cloud.forEach((item, index) => map.set(item.id, normalizeEvidence(item, index)));
  local.forEach((item, index) => map.set(item.id, normalizeEvidence(item, index)));
  return Array.from(map.values());
}
''',
    '''function mergeCloudWithDeviceFiles(cloud: Evidence[], local: Evidence[]) {
  const localFiles = new Map(
    local
      .filter((item) => item.id && item.fileData)
      .map((item) => [item.id, { fileData: item.fileData, fileName: item.fileName }] as const),
  );
  return cloud.map((item, index) => {
    const normalized = normalizeEvidence(item, index);
    const cachedFile = localFiles.get(normalized.id);
    return cachedFile
      ? {
          ...normalized,
          fileData: cachedFile.fileData,
          fileName: normalized.fileName || cachedFile.fileName,
        }
      : normalized;
  });
}
''',
)
old_effect = '''  useEffect(() => {
    if (!teacherId || !localKey) return;
    let cancelled = false;
    let localForm: PortfolioForm | null = null;
    const local = localStorage.getItem(localKey);
    if (local) {
      try {
        localForm = normalizeForm(JSON.parse(local) as Partial<PortfolioForm>);
        setForm(localForm);
      } catch {}
    }
    const loadCloud = async () => {
      try {
        const ref = doc(db, tenantCollection(teacherId, subjectKey as any, "portfolio"), "profile");
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (snap.exists()) {
          const cloudForm = normalizeForm(snap.data() as Partial<PortfolioForm>);
          const next = localForm
            ? {
                ...cloudForm,
                ...localForm,
                evidence: mergeEvidence(cloudForm.evidence, localForm.evidence),
              }
            : cloudForm;
          setForm(next);
          saveLocal(localKey, next);
        }
      } catch {
        if (!localForm) setMessage("ملف الإنجاز يعمل على هذا الجهاز، وستعود المزامنة عند توفر الخدمة.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void loadCloud();
    return () => {
      cancelled = true;
    };
  }, [teacherId, subjectKey, localKey]);
'''
new_effect = '''  useEffect(() => {
    if (!teacherId || !localKey) return;
    let localForm: PortfolioForm | null = null;
    const local = localStorage.getItem(localKey);
    if (local) {
      try {
        localForm = normalizeForm(JSON.parse(local) as Partial<PortfolioForm>);
        setForm(localForm);
      } catch {}
    }

    const ref = doc(db, tenantCollection(teacherId, subjectKey as any, "portfolio"), "profile");
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const cloudForm = normalizeForm(snap.data() as Partial<PortfolioForm>);
          const next: PortfolioForm = {
            ...cloudForm,
            evidence: mergeCloudWithDeviceFiles(cloudForm.evidence, localForm?.evidence || []),
          };
          setForm(next);
          saveLocal(localKey, next);
          localForm = next;
        } else if (localForm) {
          setForm(localForm);
        }
        setLoaded(true);
      },
      () => {
        if (localForm) setForm(localForm);
        else setMessage("تعذر الاتصال مؤقتًا. سيعود ملف الإنجاز للمزامنة تلقائيًا عند توفر الشبكة.");
        setLoaded(true);
      },
    );

    return unsubscribe;
  }, [teacherId, subjectKey, localKey]);
'''
replace_required(page_path, old_effect, new_effect)
old_persist = '''  async function persist(next: PortfolioForm, successMessage: string) {
    if (!teacherId || !localKey) return;
    setSaving(true);
    const fullCopySaved = saveLocal(localKey, next);
    setForm(next);
    const cloudEvidence = next.evidence.slice(0, 40).map((item) => ({
      ...item,
      fileData: "",
    }));
    try {
      await withTimeout(setDoc(
        doc(db, tenantCollection(teacherId, subjectKey as any, "portfolio"), "profile"),
        {
          ...next,
          evidence: cloudEvidence,
          teacherId,
          teacherName: session?.teacherName || "",
          subjectKey,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      ));
      setMessage(`${successMessage} وحُفظت النسخة السحابية.${fullCopySaved ? "" : " لم تُحفظ صورة الشاهد على الجهاز لضيق مساحة المتصفح؛ احتفظ بالرابط الأصلي."}`);
    } catch {
      setMessage(`${successMessage}${fullCopySaved ? " وحُفظت على هذا الجهاز" : "، لكن مساحة المتصفح لم تكفِ لحفظ صورة الشاهد"}، وستُزامن البيانات النصية عند توفر الخدمة.`);
    } finally {
      setSaving(false);
    }
  }
'''
new_persist = '''  async function persist(next: PortfolioForm, successMessage: string) {
    if (!teacherId || !localKey) return;
    setSaving(true);
    const syncedNext: PortfolioForm = { ...next, updatedAt: new Date().toISOString() };
    const fullCopySaved = saveLocal(localKey, syncedNext);
    setForm(syncedNext);
    const cloudEvidence = syncedNext.evidence.slice(0, 40).map((item) => ({
      ...item,
      fileData: "",
    }));
    try {
      await withTimeout(setDoc(
        doc(db, tenantCollection(teacherId, subjectKey as any, "portfolio"), "profile"),
        {
          ...syncedNext,
          evidence: cloudEvidence,
          teacherId,
          teacherName: session?.teacherName || "",
          subjectKey,
        },
        { merge: true },
      ));
      setMessage(`${successMessage} وتمت مزامنته فورًا بين الويب والتطبيق.${fullCopySaved ? "" : " لم تُحفظ صورة الشاهد على الجهاز لضيق المساحة؛ احتفظ بالرابط الأصلي."}`);
    } catch {
      setMessage(`${successMessage}${fullCopySaved ? " وحُفظ مؤقتًا على هذا الجهاز" : "، لكن مساحة الجهاز لم تكفِ لحفظ صورة الشاهد"}. ستعود المزامنة تلقائيًا عند توفر الشبكة.`);
    } finally {
      setSaving(false);
    }
  }
'''
replace_required(page_path, old_persist, new_persist)
replace_required(page_path, "<span>حفظ تلقائي على الجهاز</span>", "<span>مزامنة فورية بين التطبيق والويب</span>")
replace_required(page_path, "<span>نسخة A4 كاملة</span>", "<span>كل صفحة على ورقة A4 واحدة</span>")
replace_required(
    page_path,
    '<button type="button" className="preview-print" onClick={printPortfolio} disabled={exportingPdf}>',
    '<button type="button" className="preview-print" data-web-pdf="true" onClick={printPortfolio} disabled={exportingPdf}>',
)

# 2) Portfolio mobile usability and reliable one-sheet A4 pages.
css_path = "app/teacher/portfolio/portfolio.css"
css = read(css_path)
marker = "/* v72: unified mobile/web portfolio and one-sheet A4 output */"
if marker not in css:
    css += r'''

/* v72: unified mobile/web portfolio and one-sheet A4 output */
@media (max-width:680px){
  .portfolio-page{width:100%;max-width:100%;padding:8px 7px 96px!important;overflow-x:hidden}
  .portfolio-hero,.achievement-builder,.portfolio-command,.portfolio-library,.portfolio-settings{border-radius:18px!important}
  .achievement-builder form,.portfolio-settings-grid{grid-template-columns:1fr!important}
  .builder-title,.builder-note,.builder-actions,.portfolio-settings-grid .wide{grid-column:1!important}
  .builder-actions,.portfolio-command-actions{display:grid!important;grid-template-columns:1fr!important;width:100%}
  .builder-actions button,.portfolio-command-actions button,.save-settings{width:100%;min-height:49px!important}
  .achievement-card footer{align-items:stretch!important;gap:10px!important}
  .achievement-card footer>div{display:grid!important;grid-template-columns:1fr 1fr!important;width:100%}
  .achievement-card footer button{min-height:44px!important}
  .portfolio-preview-open{padding:0!important;background:#e8eef1!important}
  .portfolio-preview-open .portfolio-print-document{display:block!important;width:100%!important;padding:82px 5px 18px!important;overflow-x:hidden!important}
  .portfolio-preview-toolbar{position:fixed!important;top:0!important;right:0!important;left:0!important;z-index:9999!important;display:grid!important;grid-template-columns:1fr!important;gap:7px!important;padding:8px max(8px,env(safe-area-inset-right)) 8px max(8px,env(safe-area-inset-left))!important;border-radius:0!important}
  .portfolio-preview-toolbar>div:last-child{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important}
  .portfolio-preview-toolbar button{min-width:0!important;min-height:46px!important;padding:8px 6px!important;font-size:12px!important}
  .portfolio-preview-open .print-page{width:calc(100vw - 10px)!important;min-width:0!important;max-width:calc(100vw - 10px)!important;min-height:calc((100vw - 10px) * 1.4142)!important;height:auto!important;margin:7px auto!important;padding:5.5vw 5vw!important;border-radius:4px!important;box-shadow:0 5px 18px rgba(18,48,64,.14)!important;overflow:hidden!important}
  .portfolio-preview-open .print-page h1{font-size:clamp(20px,7vw,32px)!important}
  .portfolio-preview-open .print-page h2{font-size:clamp(17px,5.5vw,26px)!important}
  .portfolio-preview-open .print-page p{font-size:clamp(10px,3.1vw,14px)!important}
}

@media print{
  @page{size:A4 portrait;margin:0}
  html,body{width:210mm!important;min-width:210mm!important;margin:0!important;padding:0!important;background:#fff!important}
  .portfolio-page .portfolio-print-document .print-page{
    box-sizing:border-box!important;
    width:210mm!important;
    min-width:210mm!important;
    max-width:210mm!important;
    height:297mm!important;
    min-height:297mm!important;
    max-height:297mm!important;
    margin:0!important;
    overflow:hidden!important;
    break-inside:avoid-page!important;
    page-break-inside:avoid!important;
    break-after:page!important;
    page-break-after:always!important;
  }
  .portfolio-page .portfolio-print-document .print-page:last-child{break-after:auto!important;page-break-after:auto!important}
  .portfolio-page .portfolio-print-achievement{padding:11mm 13mm 10mm!important}
  .portfolio-page .portfolio-print-achievement>header{margin-bottom:5mm!important;padding-bottom:3.5mm!important}
  .portfolio-page .portfolio-print-achievement .print-achievement-image{max-height:78mm!important;margin-bottom:4mm!important}
  .portfolio-page .portfolio-print-achievement .print-achievement-content{gap:2.5mm!important}
  .portfolio-page .portfolio-print-achievement .print-achievement-content article{padding:3mm 3.5mm!important}
  .portfolio-page .portfolio-print-achievement .print-achievement-content p{font-size:8.8pt!important;line-height:1.55!important}
  .portfolio-page .portfolio-print-achievement .print-evidence-reference{margin-top:3mm!important;padding:2.5mm 3mm!important}
}

.portfolio-pdf-exporting .portfolio-print-document .print-page{
  box-sizing:border-box!important;
  width:794px!important;
  min-width:794px!important;
  max-width:794px!important;
  height:1123px!important;
  min-height:1123px!important;
  max-height:1123px!important;
  overflow:hidden!important;
}
'''
    write(css_path, css)

# 3) PWA: never serve stale protected pages; update immediately when a new build exists.
sw_path = "public/sw.js"
write(sw_path, '''const CACHE_NAME = "ostadh-lahooni-v72-mobile-web-sync";
const STATIC_FILES = [
  "/",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icons/ostadh-lahooni-192.jpg",
  "/portal-cover.webp",
];

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(STATIC_FILES.map(path => cache.add(new Request(path, { cache: "reload" })))))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/") || url.searchParams.has("_rsc")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .catch(async () => (await caches.match("/")) || Response.error()),
    );
    return;
  }

  if (["style", "script", "font"].includes(request.destination)) {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(() => caches.match(request)));
    return;
  }

  if (["image", "manifest"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        return response;
      })),
    );
  }
});
''')

pwa_path = "app/pwa-register.tsx"
write(pwa_path, '''"use client";

import { useEffect } from "react";

const CURRENT_CACHE = "ostadh-lahooni-v72-mobile-web-sync";
const RELOAD_KEY = "ostadh-lahooni-v72-mobile-web-sync-reloaded";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;
    let registration: ServiceWorkerRegistration | null = null;
    const activateWaitingWorker = () => {
      if (registration?.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    };
    const handleControllerChange = () => {
      if (refreshing || sessionStorage.getItem(RELOAD_KEY)) return;
      refreshing = true;
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    };
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") void registration?.update();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    document.addEventListener("visibilitychange", checkForUpdate);

    const register = async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key !== CURRENT_CACHE).map(key => caches.delete(key)));
        registration = await navigator.serviceWorker.register("/sw.js?v=72-mobile-web-sync", {
          scope: "/",
          updateViaCache: "none",
        });
        registration.addEventListener("updatefound", () => {
          registration?.installing?.addEventListener("statechange", activateWaitingWorker);
        });
        await registration.update();
        activateWaitingWorker();
      } catch {
        // تبقى المنصة متاحة حتى لو تعذر تشغيل وضع التطبيق.
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
    const interval = window.setInterval(checkForUpdate, 5 * 60 * 1000);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", checkForUpdate);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}
''')

# 4) Native Android shell: same production URL, fresh web build, custom PDF button stays in web code.
main_path = "android-app/app/src/main/java/com/ostadlahooni/app/MainActivity.java"
replace_required(main_path, 'private static final String APP_VERSION = "1.6.0";', 'private static final String APP_VERSION = "1.7.0";')
replace_required(main_path, '    private ToneGenerator introTone;\n', '    private ToneGenerator introTone;\n    private long lastRefreshAt = 0L;\n')
replace_required(main_path, "var cacheKey='ostadh-clean-1.6.0';", "var cacheKey='ostadh-clean-1.7.0';")
replace_required(
    main_path,
    "if(button.classList.contains('print-sheet-button')||button.dataset.nativePrint==='true'||text.indexOf('طباعة')>-1){e.preventDefault();e.stopImmediatePropagation();window.ostadhNativePrint(document.title||'كشف أستاذ لحوني');return;}",
    "if(button.dataset.webPdf!=='true'&&(button.classList.contains('print-sheet-button')||button.dataset.nativePrint==='true'||text.indexOf('طباعة')>-1)){e.preventDefault();e.stopImmediatePropagation();window.ostadhNativePrint(document.title||'كشف أستاذ لحوني');return;}",
)
replace_required(
    main_path,
    "                view.evaluateJavascript(bridgeScript, null);\n",
    "                lastRefreshAt = System.currentTimeMillis();\n                view.evaluateJavascript(bridgeScript, null);\n",
)
replace_required(
    main_path,
    "    @Override protected void onSaveInstanceState(Bundle outState) { webView.saveState(outState); super.onSaveInstanceState(outState); }\n",
    '''    @Override protected void onResume() {
        super.onResume();
        if (webView == null) return;
        long now = System.currentTimeMillis();
        if (lastRefreshAt > 0L && now - lastRefreshAt > 5 * 60 * 1000L) {
            lastRefreshAt = now;
            webView.reload();
        }
    }
    @Override protected void onSaveInstanceState(Bundle outState) { webView.saveState(outState); super.onSaveInstanceState(outState); }
''',
)

build_path = "android-app/app/build.gradle"
replace_required(build_path, "versionCode 10", "versionCode 11")
replace_required(build_path, "versionName '1.6.0'", "versionName '1.7.0'")

print("Applied v72 mobile/web sync, PWA freshness, responsive portfolio, and A4 page fixes.")
