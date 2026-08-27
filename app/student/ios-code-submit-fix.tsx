"use client";

import { useEffect } from "react";

const CODE_PATTERN = /^TH[123]\d{3}$/;

export default function IosCodeSubmitFix() {
  useEffect(() => {
    let attempts = 0;
    const setNativeValue = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const bind = () => {
      const form = document.querySelector<HTMLFormElement>(".student-login-form form");
      if (!form || form.dataset.iosSubmitFixed === "true") return false;
      const inputs = Array.from(form.querySelectorAll<HTMLInputElement>("input"));
      const identityInput = inputs.find(input => input.inputMode === "numeric" || input.placeholder.includes("١٠"));
      const codeInput = inputs.find(input => input !== identityInput);
      const submit = form.querySelector<HTMLButtonElement>("button[type='submit'], .portal-submit");
      if (!codeInput || !submit) return false;

      form.dataset.iosSubmitFixed = "true";
      if (identityInput) {
        identityInput.required = false;
        setNativeValue(identityInput, "0000000000");
      }

      codeInput.style.pointerEvents = "auto";
      codeInput.style.touchAction = "manipulation";
      submit.disabled = false;
      submit.type = "submit";
      submit.style.pointerEvents = "auto";
      submit.style.touchAction = "manipulation";

      const prepare = () => {
        const code = codeInput.value.trim().toUpperCase();
        if (identityInput) setNativeValue(identityInput, "0000000000");
        setNativeValue(codeInput, code);
        return CODE_PATTERN.test(code);
      };

      form.addEventListener("submit", event => {
        if (prepare()) return;
        event.preventDefault();
        const existing = form.querySelector<HTMLElement>(".portal-error");
        if (existing) existing.textContent = "أدخل كودًا صحيحًا مثل TH1001 أو TH2001 أو TH3001.";
      });

      codeInput.addEventListener("keydown", event => {
        if (event.key === "Enter" && !prepare()) event.preventDefault();
      });

      return true;
    };

    if (bind()) return;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (bind() || attempts >= 20) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
