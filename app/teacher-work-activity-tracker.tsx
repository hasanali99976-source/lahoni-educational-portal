"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type WorkKind = "attendance" | "grades" | "note" | "referral" | "diagnostic" | "remedial" | "gradePlan" | "timetable";

function currentContext() {
  const selects = [...document.querySelectorAll("select")]
    .map(item => (item as HTMLSelectElement).value)
    .filter(Boolean)
    .slice(0, 4)
    .join("|");
  return `${window.location.pathname}|${selects}`;
}

function kindFromSuccessText(text: string): WorkKind | null {
  if (/تم حفظ درجات|تم حفظ.*الدرجات/.test(text)) return "grades";
  if (/تم حفظ الملاحظة/.test(text)) return "note";
  if (/تم تسجيل إحالة/.test(text)) return "referral";
  if (/تم حفظ التحضير ومزامنته|تمت مزامنة التعديل/.test(text)) return "attendance";
  return null;
}

function kindFromRequest(url: string, method: string): WorkKind | null {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return null;
  if (url.includes("/api/teacher/activity")) return null;
  if (url.includes("/api/teacher/grade-plan")) return "gradePlan";
  if (url.includes("/api/teacher/timetable")) return "timetable";
  if (url.includes("/api/teacher/diagnostics/remedial-plans")) return "remedial";
  if (url.includes("/api/teacher/diagnostics/")) return "diagnostic";
  return null;
}

export default function TeacherWorkActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.startsWith("/teacher/") || pathname === "/teacher") return;
    const recentlySent = new Map<string, number>();

    const send = (kind: WorkKind, signature: string, meta: Record<string, unknown> = {}) => {
      const key = `${kind}:${signature}`;
      const last = recentlySent.get(key) || 0;
      if (Date.now() - last < 5000) return;
      recentlySent.set(key, Date.now());
      window.fetch("/api/teacher/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, signature, meta }),
        cache: "no-store",
      }).catch(() => undefined);
    };

    const onAttendance = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      const className = String(detail.class || "");
      const date = String(detail.date || "");
      if (!className || !date) return;
      send("attendance", `${pathname}:${className}:${date}`, { className, date });
    };
    window.addEventListener("lahooni:attendance-updated", onAttendance as EventListener);

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        const target = mutation.target as HTMLElement;
        const text = (target.textContent || "").trim();
        if (!text || text.length > 500) continue;
        const kind = kindFromSuccessText(text);
        if (!kind) continue;
        send(kind, `${currentContext()}:${text.slice(0, 90)}`, { source: "confirmed-ui-success" });
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    const originalFetch = window.fetch.bind(window);
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);
      try {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const method = String(init?.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
        const kind = kindFromRequest(url, method);
        if (kind && response.ok) {
          const body = typeof init?.body === "string" ? init.body.slice(0, 300) : "";
          send(kind, `${pathname}:${url.split("?")[0]}:${body}`, { source: "successful-api-write" });
        }
      } catch {
        // Tracking must never interfere with teacher work.
      }
      return response;
    }) as typeof window.fetch;

    return () => {
      window.removeEventListener("lahooni:attendance-updated", onAttendance as EventListener);
      observer.disconnect();
      window.fetch = originalFetch;
    };
  }, [pathname]);

  return null;
}
