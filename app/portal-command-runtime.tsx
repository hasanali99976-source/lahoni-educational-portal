"use client";

import { useEffect } from "react";

const COMMAND_LABELS: Array<{ pattern: RegExp; command: string; icon: string }> = [
  { pattern: /تسجيل الخروج/, command: "logout", icon: "🚪" },
  { pattern: /طباعة|PDF/i, command: "print", icon: "🖨️" },
  { pattern: /(^|\s)المواد(\s|$)/, command: "subjects", icon: "📚" },
  { pattern: /الرئيسية|الصفحة الرئيسية/, command: "home", icon: "🏠" },
];

function visiblePanel(root: HTMLElement) {
  const panels = [...root.querySelectorAll<HTMLElement>(".student-tab-panel")];
  return panels.find(panel => {
    const style = window.getComputedStyle(panel);
    return style.display !== "none" && style.visibility !== "hidden";
  }) || panels[0] || null;
}

function cleanClone(source: HTMLElement | null) {
  if (!source) return null;
  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("button, nav, script, style, textarea, select, input[type='range']").forEach(node => node.remove());
  clone.querySelectorAll<HTMLElement>("[style]").forEach(node => {
    node.style.position = "static";
    node.style.transform = "none";
  });
  return clone;
}

function openStudentPrintReport() {
  const root = document.querySelector<HTMLElement>(".student-clean");
  if (!root) return;

  const header = cleanClone(root.querySelector<HTMLElement>(".student-clean-head"));
  const panel = cleanClone(visiblePanel(root));
  const popup = window.open("", "lahooni-student-print", "width=1100,height=850");
  if (!popup) {
    window.alert("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.");
    return;
  }

  const date = new Intl.DateTimeFormat("ar-SA-u-nu-arab", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>تقرير الطالب - بوابة أستاذ لحوني</title>
<style>
@page{size:A4 portrait;margin:12mm}
*{box-sizing:border-box}
html,body{margin:0;background:#eef4f5;color:#122b35;font-family:Arial,Tahoma,sans-serif;direction:rtl}
body{padding:20px}
.toolbar{position:sticky;top:0;z-index:5;display:flex;justify-content:center;gap:10px;padding:10px;margin:-20px -20px 18px;background:#0b736b}
.toolbar button{border:0;border-radius:10px;padding:11px 18px;font:inherit;font-weight:800;cursor:pointer}
.report{width:min(900px,100%);margin:auto;background:#fff;padding:20px;border-radius:18px;box-shadow:0 12px 34px rgba(17,57,66,.12)}
.report-brand{text-align:center;border-bottom:2px solid #0b736b;padding-bottom:10px;margin-bottom:14px}
.report-brand strong{display:block;font-size:20px;color:#0b736b}.report-brand span{font-size:12px;color:#667b84}
.student-clean-head{display:block!important;background:#fff!important;color:#111!important;border:2px solid #0b736b!important;border-radius:14px!important;padding:16px!important;margin-bottom:14px!important}
.student-clean-head h1{margin:6px 0!important;font-size:24px!important}.student-clean-head p,.student-clean-head span{color:#333!important}
.student-tab-panel,.student-main-summary,.student-attendance-summary,.student-home-grid article,.student-mini-stats article,.student-units-table,.student-goal-panel,.student-ai-hub,.student-diagnostics{background:#fff!important;color:#111!important;border:1px solid #c8d5d8!important;border-radius:12px!important;box-shadow:none!important}
.student-tab-panel{display:block!important;margin:0!important;padding:0!important}
.student-main-summary,.student-attendance-summary,.student-units-table,.student-goal-panel,.student-ai-hub,.student-diagnostics{padding:14px!important;margin-bottom:12px!important}
.student-mini-stats,.student-home-grid,.student-ai-grid,.attendance-discipline-grid,.goal-numbers{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin:10px 0!important}
.student-mini-stats article,.student-home-grid article,.student-ai-grid article,.attendance-discipline-grid article{padding:10px!important;break-inside:avoid}
.student-score-ring,.attendance-discipline-rate,.goal-ring{border:2px solid #0b736b!important;background:#fff!important;color:#111!important;box-shadow:none!important}
table{width:100%!important;min-width:0!important;border-collapse:collapse!important;table-layout:fixed!important}
th,td{border:1px solid #9fb1b7!important;padding:7px!important;text-align:right!important;font-size:11px!important;color:#111!important}
th{background:#eaf4f2!important}
.student-table-scroll{overflow:visible!important;border:0!important}
h1,h2,h3,p,span,strong,small,li,td,th{color:#111!important;text-shadow:none!important}
footer{text-align:center;margin-top:14px;padding-top:10px;border-top:1px solid #b9c8cc;font-size:11px;color:#60727a}
@media print{html,body{background:#fff!important}body{padding:0!important}.toolbar{display:none!important}.report{width:100%!important;padding:0!important;border-radius:0!important;box-shadow:none!important}.student-clean-head,.student-tab-panel,.student-main-summary,.student-attendance-summary,.student-home-grid article,.student-mini-stats article,.student-units-table,.student-goal-panel,.student-ai-hub,.student-diagnostics{break-inside:avoid;page-break-inside:avoid}}
</style>
</head>
<body data-print-ready="1">
<div class="toolbar"><button onclick="window.print()">🖨️ طباعة أو حفظ PDF</button><button onclick="window.close()">إغلاق</button></div>
<main class="report">
  <div class="report-brand"><strong>بوابة أستاذ لحوني التعليمية</strong><span>تقرير الطالب — ${date}</span></div>
  ${header?.outerHTML || ""}
  ${panel?.outerHTML || "<p>لا توجد بيانات ظاهرة للطباعة.</p>"}
  <footer>تم إنشاء هذا التقرير من بوابة أستاذ لحوني التعليمية</footer>
</main>
<script>
window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},350);});
</script>
</body>
</html>`);
  popup.document.close();
}

function clearPortalStorage() {
  try {
    const localKeys = Object.keys(window.localStorage).filter(key => key.startsWith("lahooni-") || key.startsWith("portalV2"));
    const sessionKeys = Object.keys(window.sessionStorage).filter(key => key.startsWith("lahooni-") || key.startsWith("portalV2"));
    localKeys.forEach(key => window.localStorage.removeItem(key));
    sessionKeys.forEach(key => window.sessionStorage.removeItem(key));
  } catch {
    // Continue with the server logout and hard redirect.
  }
}

function logoutTarget(pathname: string) {
  if (pathname.startsWith("/teacher")) return "/teacher";
  if (pathname.startsWith("/admin")) return "/admin";
  return "/student";
}

function runLogout(pathname: string) {
  clearPortalStorage();
  const requests: Promise<unknown>[] = [];
  if (pathname.startsWith("/teacher")) {
    requests.push(fetch("/api/teacher-logout", { method: "POST", cache: "no-store", keepalive: true }).catch(() => undefined));
    requests.push(fetch("/api/auth/logout", { method: "POST", cache: "no-store", keepalive: true }).catch(() => undefined));
  } else if (pathname.startsWith("/admin")) {
    requests.push(fetch("/api/auth/logout", { method: "POST", cache: "no-store", keepalive: true }).catch(() => undefined));
  }

  let redirected = false;
  const redirect = () => {
    if (redirected) return;
    redirected = true;
    window.location.replace(`${logoutTarget(pathname)}?logout=${Date.now()}`);
  };
  Promise.allSettled(requests).finally(redirect);
  window.setTimeout(redirect, 900);
}

function decorateCommands() {
  document.querySelectorAll<HTMLElement>("button, a").forEach(element => {
    const text = (element.textContent || "").replace(/\s+/g, " ").trim();
    const match = COMMAND_LABELS.find(item => item.pattern.test(text));
    if (!match) return;
    element.dataset.portalCommand = match.command;
    element.dataset.portalIcon = match.icon;
    if (element instanceof HTMLButtonElement && !element.getAttribute("type")) element.type = "button";
    if (!element.getAttribute("aria-label")) element.setAttribute("aria-label", text);
  });
}

export default function PortalCommandRuntime() {
  useEffect(() => {
    decorateCommands();
    const observer = new MutationObserver(decorateCommands);
    observer.observe(document.body, { childList: true, subtree: true });

    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("button, a") : null;
      if (!target) return;
      const command = target.dataset.portalCommand;
      const pathname = window.location.pathname;

      if (command === "print" && pathname.startsWith("/student") && target.closest(".student-head-actions")) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        openStudentPrintReport();
        return;
      }

      if (command === "logout" && (pathname.startsWith("/student") || pathname.startsWith("/parent") || pathname.startsWith("/family") || pathname.startsWith("/teacher") || pathname.startsWith("/admin"))) {
        target.setAttribute("aria-busy", "true");
        runLogout(pathname);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return <style>{`
    [data-portal-command]{touch-action:manipulation;-webkit-tap-highlight-color:transparent;cursor:pointer}
    [data-portal-command]::before{content:attr(data-portal-icon);display:inline-block;margin-inline-end:.38em;font-size:1.05em;line-height:1}
    [data-portal-command="logout"][aria-busy="true"]{pointer-events:none;opacity:.72}
  `}</style>;
}
