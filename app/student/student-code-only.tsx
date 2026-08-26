"use client";

import { useEffect } from "react";

const CODE_PATTERN = /^TH[123]\d{3}$/;

export default function StudentCodeOnly() {
  useEffect(() => {
    const apply = () => {
      const form = document.querySelector<HTMLFormElement>(".student-login-form form");
      if (!form || form.dataset.codeOnly === "true") return;
      form.dataset.codeOnly = "true";

      const inputs = Array.from(form.querySelectorAll<HTMLInputElement>("input"));
      const identityInput = inputs.find(input => input.inputMode === "numeric" || input.placeholder.includes("١٠"));
      const codeInput = inputs.find(input => input !== identityInput);

      if (identityInput) {
        identityInput.value = "0000000000";
        const wrapper = identityInput.closest(".portal-input");
        const label = wrapper?.previousElementSibling;
        wrapper?.setAttribute("hidden", "true");
        label?.setAttribute("hidden", "true");
      }

      const help = form.parentElement?.querySelector<HTMLElement>(".student-login-help");
      if (help) help.textContent = "أدخل كود الطالب فقط. يبدأ الكود بـ TH ثم رقم الصف ثم ثلاثة أرقام.";

      if (codeInput) {
        codeInput.maxLength = 6;
        codeInput.placeholder = "مثال: TH1001 أو TH2001 أو TH3001";
        codeInput.setAttribute("autocomplete", "username");
        codeInput.addEventListener("input", () => {
          codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
          identityInput && (identityInput.value = "0000000000");
        });
      }

      form.addEventListener("submit", event => {
        if (identityInput) identityInput.value = "0000000000";
        const code = codeInput?.value.trim().toUpperCase() || "";
        if (!CODE_PATTERN.test(code)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const existing = form.querySelector<HTMLElement>(".portal-error");
          if (existing) existing.textContent = "الكود يجب أن يكون مثل TH1001 أو TH2001 أو TH3001.";
          else {
            const error = document.createElement("p");
            error.className = "portal-error";
            error.textContent = "الكود يجب أن يكون مثل TH1001 أو TH2001 أو TH3001.";
            form.querySelector("button")?.before(error);
          }
        }
      }, true);
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
