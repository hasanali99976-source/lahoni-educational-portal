"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";

const CODE_PATTERN = /^TH[123]\d{3}$/;

export default function StudentQrLinkUpgrader() {
  const [code, setCode] = useState("");
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const replaceOldQr = (card: HTMLElement | null) => {
      if (!card) return;
      card.querySelectorAll<SVGElement>("svg:not([data-student-qr-link])").forEach(svg => svg.remove());
    };

    const handleClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(".code-button");
      if (!button) return;
      const value = button.textContent?.trim().toUpperCase() || "";
      if (!CODE_PATTERN.test(value)) return;
      setCode(value);
      window.setTimeout(() => {
        const card = document.querySelector<HTMLElement>(".qr-card");
        replaceOldQr(card);
        if (card) setTarget(card);
      }, 0);
    };

    const observer = new MutationObserver(() => {
      const card = document.querySelector<HTMLElement>(".qr-card");
      replaceOldQr(card);
      setTarget(card);
      if (!card) setCode("");
    });

    document.addEventListener("click", handleClick, true);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("click", handleClick, true);
      observer.disconnect();
    };
  }, []);

  if (!target || !code) return null;

  const url = `${window.location.origin}/student/qr/${encodeURIComponent(code)}`;

  return createPortal(
    <>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="فتح بوابة الطالب بالكود"
        style={{ display: "inline-block", cursor: "pointer", lineHeight: 0 }}
      >
        <QRCodeSVG
          data-student-qr-link="true"
          value={url}
          size={232}
          level="H"
          includeMargin
        />
      </a>
      <small style={{ display: "block", marginTop: 8 }}>امسح الباركود بالآيفون أو اضغط عليه لفتح بوابة الطالب بالكود فقط</small>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn primary"
        style={{ display: "inline-flex", marginTop: 10, textDecoration: "none" }}
      >فتح بوابة الطالب</a>
    </>,
    target,
  );
}
