"use client";

import { useEffect } from "react";

const CODE_PATTERN = /^TH[123]\d{3}$/;

export default function IosCodeSubmitFix() {
  useEffect(() => {
    const setNativeValue = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const bind = () => {
      const form = document.querySelector<HTMLFormElement>(".student-login-form form");
      if (!form || form.dataset.iosSubmitFixed === "true") return;

      const inputs = Array.from(form.querySelectorAll<HTMLInputElement>("input"));
      const identityInput = inputs.find(input => input.inputMode === "numeric" || input.placeholder.includes("١٠"));
      const codeInput = inputs.find(input => input !== identityInput);
      const submit = form.querySelector<HTMLButtonElement>("button[type='submit'], .portal-submit");
      if (!codeInput || !submit) return;

      form.dataset.iosSubmitFixed = "true";
      if (identityInput) {
        identityInput.required = false;
        identityInput.setAttribute("aria-hidden", "true");
        setNativeValue(identityInput, "0000000000");
      }

      submit.disabled = false;
      submit.style.pointerEvents = "auto";
      submit.style.touchAction = "manipulation";
      submit.setAttribute("type", "button");

      const activate = () => {
        const code = codeInput.value.trim().toUpperCase();
        if (!CODE_PATTERN.test(code)) {
          const existing = form.querySelector<HTMLElement>(".portal-error");
          if (existing) existing.textContent = "أدخل كودًا صحيحًا مثل TH1001 أو TH2001 أو TH3001.";
          return;
        }
        if (identityInput) setNativeValue(identityInput, "0000000000");
        setNativeValue(codeInput, code);
        submit.disabled = false;
        window.requestAnimationFrame(() => {
          submit.setAttribute("type", "submit");
          form.requestSubmit(submit);
          submit.setAttribute("type", "button");
        });
      };

      submit.addEventListener("click", activate, true);
      submit.addEventListener("touchend", event => {
        event.preventDefault();
        activate();
      }, { passive: false, capture: true });
      codeInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          activate();
        }
      });
    };

    bind();
    const observer = new MutationObserver(bind);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
