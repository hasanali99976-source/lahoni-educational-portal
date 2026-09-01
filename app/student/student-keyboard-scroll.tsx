"use client";

import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}

export default function StudentKeyboardScroll() {
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

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      root.style.overflowY = previous.rootOverflowY;
      root.style.height = previous.rootHeight;
      root.style.scrollBehavior = previous.rootScrollBehavior;
      body.style.overflowY = previous.bodyOverflowY;
      body.style.height = previous.bodyHeight;
    };
  }, []);

  return null;
}
