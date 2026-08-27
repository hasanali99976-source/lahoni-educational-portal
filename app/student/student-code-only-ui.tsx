"use client";

import { useEffect } from "react";

const CODE_PATTERN = /^TH[123]\d{3}$/;

export default function StudentCodeOnlyUI() {
  useEffect(() => {
    let attempts = 0;
    let cancelled = false;

    const setNativeValue = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const applyOnce = () => {
      if (cancelled) return true;
      const form = document.querySelector<HTMLFormElement>(".student-login-form form");
      if (!form) return false;

      const inputs = Array.from(form.querySelectorAll<HTMLInputElement>("input"));
      const identityInput = inputs.find(input => input.inputMode === "numeric" || input.getAttribute("placeholder")?.includes("١٠"));
      const codeInput = inputs.find(input => input !== identityInput);
      const submit = form.querySelector<HTMLButtonElement>("button[type='submit'], .portal-submit");
      const queryCode = new URLSearchParams(window.location.search).get("code")?.trim().toUpperCase() || "";

      if (identityInput) {
        identityInput.required = false;
        identityInput.tabIndex = -1;
        setNativeValue(identityInput, "0000000000");
      }

      if (codeInput) {
        codeInput.placeholder = "مثال: TH1001";
        codeInput.maxLength = 6;
        codeInput.autocomplete = "username";
        codeInput.inputMode = "text";
        codeInput.enterKeyHint = "go";
        codeInput.setAttribute("autocapitalize", "characters");
        codeInput.setAttribute("spellcheck", "false");
        codeInput.style.pointerEvents = "auto";
        codeInput.style.touchAction = "manipulation";
        codeInput.style.position = "relative";
        codeInput.style.zIndex = "20";
        codeInput.setAttribute("aria-label", "كود الطالب");
        if (CODE_PATTERN.test(queryCode)) setNativeValue(codeInput, queryCode);
      }

      if (submit) {
        submit.disabled = false;
        submit.type = "submit";
        submit.style.pointerEvents = "auto";
        submit.style.touchAction = "manipulation";
        submit.style.position = "relative";
        submit.style.zIndex = "20";
      }

      const help = form.parentElement?.querySelector<HTMLElement>(".student-login-help");
      if (help) help.textContent = CODE_PATTERN.test(queryCode)
        ? "جارٍ فتح بوابة الطالب بالكود الموجود في الباركود…"
        : "أدخل كود الطالب فقط للدخول إلى جميع المواد المرتبطة به.";

      return Boolean(codeInput && submit);
    };

    if (!applyOnce()) {
      const timer = window.setInterval(() => {
        attempts += 1;
        if (applyOnce() || attempts >= 20) window.clearInterval(timer);
      }, 100);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    }

    return () => { cancelled = true; };
  }, []);

  return null;
}
