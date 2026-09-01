"use client";

import { useEffect, useState } from "react";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}

export default function StudentKeyboardScroll() {
  const [position, setPosition] = useState({ up: false, down: true });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previous = {
      rootOverflowY: root.style.overflowY,
      rootHeight: root.style.height,
      rootScrollBehavior: root.style.scrollBehavior,
      bodyOverflowY: body.style.overflowY,
      bodyHeight: body.style.height,
    };

    root.style.overflowY = "auto";
    root.style.height = "auto";
    root.style.scrollBehavior = "smooth";
    body.style.overflowY = "auto";
    body.style.height = "auto";

    const update = () => {
      const top = window.scrollY || root.scrollTop || body.scrollTop || 0;
      const max = Math.max(0, root.scrollHeight - window.innerHeight);
      setPosition({ up: top > 8, down: top < max - 8 });
    };

    const move = (top: number) => window.scrollBy({ top, behavior: "smooth" });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) return;
      const pageStep = Math.max(320, Math.round(window.innerHeight * 0.78));
      if (event.key === "ArrowDown") { event.preventDefault(); move(120); }
      else if (event.key === "ArrowUp") { event.preventDefault(); move(-120); }
      else if (event.key === "PageDown") { event.preventDefault(); move(pageStep); }
      else if (event.key === "PageUp") { event.preventDefault(); move(-pageStep); }
      else if (event.key === "Home") { event.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else if (event.key === "End") { event.preventDefault(); window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }); }
      else if (event.key === " " && !(event.target instanceof Element && event.target.closest("button,a"))) { event.preventDefault(); move(event.shiftKey ? -pageStep : pageStep); }
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("keydown", onKeyDown);
      root.style.overflowY = previous.rootOverflowY;
      root.style.height = previous.rootHeight;
      root.style.scrollBehavior = previous.rootScrollBehavior;
      body.style.overflowY = previous.bodyOverflowY;
      body.style.height = previous.bodyHeight;
    };
  }, []);

  return <aside className="student-scroll-controller" aria-label="التنقل داخل صفحة الطالب">
    <button type="button" disabled={!position.up} onClick={() => window.scrollBy({ top: -Math.max(320, window.innerHeight * .75), behavior: "smooth" })} aria-label="الصعود في الصفحة">↑</button>
    <span>تنقّل</span>
    <button type="button" disabled={!position.down} onClick={() => window.scrollBy({ top: Math.max(320, window.innerHeight * .75), behavior: "smooth" })} aria-label="النزول في الصفحة">↓</button>
  </aside>;
}
