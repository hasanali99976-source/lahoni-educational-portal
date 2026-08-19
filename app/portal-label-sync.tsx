"use client";

import { useEffect } from "react";

const replacements: Array<[string, string]> = [
  ["بوابة الطالب", "بوابة ولي الأمر / الطالب"],
  ["دخول الطالب", "دخول ولي الأمر / الطالب"],
  ["للطالب وولي الأمر", "لولي الأمر والطالب"],
];

export default function PortalLabelSync() {
  useEffect(() => {
    const sync = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent || ["SCRIPT", "STYLE"].includes(parent.tagName)) continue;
        let value = node.textContent || "";
        let next = value;
        replacements.forEach(([from, to]) => { next = next.replaceAll(from, to); });
        if (next !== value) node.textContent = next;
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
