"use client";

import { useEffect } from "react";

export default function AdminLoginEnhancer() {
  useEffect(() => {
    if (window.location.pathname !== "/admin") return;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      let response: Response;

      if (url.endsWith("/api/auth/login") && init?.method === "POST") {
        let username = "";
        try {
          const payload = JSON.parse(String(init.body || "{}"));
          username = String(payload.username || "");
        } catch {}
        response = await originalFetch("/api/auth/admin-name-login", {
          ...init,
          body: JSON.stringify({ username }),
          cache: "no-store",
        });
      } else {
        response = await originalFetch(input, init);
      }

      const isAdminLogin = url.endsWith("/api/auth/admin-name-login") || url.endsWith("/api/auth/login");
      if (isAdminLogin && init?.method === "POST" && response.ok) {
        window.setTimeout(() => {
          if (window.location.pathname === "/admin") window.location.replace("/admin");
        }, 250);
      }

      return response;
    };

    const simplifyForm = () => {
      const form = document.querySelector<HTMLFormElement>(".v3-admin-login form");
      if (!form) return;
      const password = form.querySelector<HTMLInputElement>('input[type="password"], input[autocomplete="current-password"]');
      const label = password?.closest("label");
      if (label) label.style.display = "none";
      if (password) {
        password.required = false;
        password.value = "name-only-admin-login";
        password.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const intro = document.querySelector<HTMLElement>(".v3-admin-login .v3-login-card p");
      if (intro) intro.textContent = "أدخل اسم المدير للوصول إلى الحسابات والصلاحيات.";
    };

    simplifyForm();
    const observer = new MutationObserver(simplifyForm);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.fetch = originalFetch;
      observer.disconnect();
    };
  }, []);

  return null;
}
