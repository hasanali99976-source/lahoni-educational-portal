"use client";

import { useEffect } from "react";

const CODE_PATTERN = /^TH[123]\d{3}$/;

export default function StudentCodeOnlyUI() {
  useEffect(() => {
    const apply = () => {
      const form = document.querySelector<HTMLFormElement>(".student-login-form form");
      if (!form) return;

      const inputs = Array.from(form.querySelectorAll<HTMLInputElement>("input"));
      const identityInput = inputs.find(input => input.inputMode === "numeric" || input.getAttribute("placeholder")?.includes("١٠"));
      const codeInput = inputs.find(input => input !== identityInput);

      if (identityInput) {
        const wrapper = identityInput.closest(".portal-input");
        const label = wrapper?.previousElementSibling;
        if (label instanceof HTMLElement) label.style.display = "none";
        if (wrapper instanceof HTMLElement) wrapper.style.display = "none";

        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(identityInput, "0000000000");
        identityInput.dispatchEvent(new Event("input", { bubbles: true }));
      }

      const help = form.parentElement?.querySelector<HTMLElement>(".student-login-help");
      if (help) help.textContent = "أدخل كود الطالب فقط للدخول إلى جميع المواد المرتبطة به.";

      if (codeInput) {
        codeInput.placeholder = "مثال: TH1001";
        codeInput.maxLength = 6;
        codeInput.autocomplete = "username";
        codeInput.setAttribute("aria-label", "كود الطالب");
        const codeWrapper = codeInput.closest(".portal-input");
        const codeLabel = codeWrapper?.previousElementSibling;
        if (codeLabel) codeLabel.textContent = "كود الطالب";
      }

      const submit = form.querySelector<HTMLButtonElement>("button[type='submit'], .portal-submit");
      if (submit && !submit.dataset.codeOnlyBound) {
        submit.dataset.codeOnlyBound = "true";
        form.addEventListener("submit", event => {
          const value = (codeInput?.value || "").trim().toUpperCase();
          if (!CODE_PATTERN.test(value)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const existing = form.querySelector<HTMLElement>(".portal-error");
            if (existing) existing.textContent = "أدخل كودًا صحيحًا مثل TH1001 أو TH2001 أو TH3001.";
            else {
              const error = document.createElement("p");
              error.className = "portal-error";
              error.textContent = "أدخل كودًا صحيحًا مثل TH1001 أو TH2001 أو TH3001.";
              submit.before(error);
            }
          }
        }, true);
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
