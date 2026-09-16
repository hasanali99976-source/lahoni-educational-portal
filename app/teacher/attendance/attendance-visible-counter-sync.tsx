"use client";

import { useEffect } from "react";

type Status = "present" | "absent" | "late" | "excused" | "escaped";

const LABEL_TO_STATUS: Record<string, Status> = {
  "حاضر": "present",
  "غائب": "absent",
  "متأخر": "late",
  "مستأذن": "excused",
  "هروب": "escaped",
};

const TOTAL_LABELS: Record<Status, string[]> = {
  present: ["إجمالي الحضور", "الحضور"],
  absent: ["إجمالي الغياب", "الغياب"],
  late: ["إجمالي التأخير", "التأخير"],
  excused: ["إجمالي الاستئذان", "الاستئذان"],
  escaped: ["إجمالي الهروب", "الهروب"],
};

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export default function AttendanceVisibleCounterSync() {
  useEffect(() => {
    let scheduled = 0;
    let writing = false;

    const sync = () => {
      scheduled = 0;
      if (writing) return;
      const root = document.querySelector<HTMLElement>(".attendance-page");
      if (!root) return;

      const counts: Record<Status, number> = { present: 0, absent: 0, late: 0, excused: 0, escaped: 0 };
      const rows = [...root.querySelectorAll<HTMLElement>(".attendance-list article")];
      rows.forEach((row) => {
        const active = [...row.querySelectorAll<HTMLButtonElement>(".status-buttons button")]
          .find((button) => button.classList.contains("active"));
        const status = LABEL_TO_STATUS[clean(active?.textContent)];
        if (status) counts[status] += 1;
      });
      if (!rows.length) return;

      writing = true;
      try {
        const stats = root.querySelector<HTMLElement>(".attendance-stats");
        if (stats) {
          const spans = [...stats.querySelectorAll<HTMLElement>("span")];
          const order: Status[] = ["present", "absent", "late", "excused", "escaped"];
          order.forEach((status, index) => {
            const span = spans[index];
            if (!span) return;
            const label = status === "present" ? "حاضر" : status === "absent" ? "غائب" : status === "late" ? "متأخر" : status === "excused" ? "مستأذن" : "هروب";
            span.textContent = `${label}: ${counts[status]}`;
          });
        }

        const overview = root.querySelector<HTMLElement>(".attendance-overview");
        const presentValue = overview?.querySelector<HTMLElement>("article.present strong");
        const absentValue = overview?.querySelector<HTMLElement>("article.absent strong");
        if (presentValue) presentValue.textContent = String(counts.present);
        if (absentValue) absentValue.textContent = String(counts.absent);

        const allElements = [...root.querySelectorAll<HTMLElement>("article,div,section")];
        (Object.keys(TOTAL_LABELS) as Status[]).forEach((status) => {
          allElements.forEach((element) => {
            const labelNode = [...element.querySelectorAll<HTMLElement>("span,small,p")]
              .find((node) => TOTAL_LABELS[status].includes(clean(node.textContent)));
            if (!labelNode) return;
            const valueNode = element.querySelector<HTMLElement>("strong,b,[data-attendance-total]");
            if (valueNode && valueNode !== labelNode) valueNode.textContent = String(counts[status]);
          });
        });
      } finally {
        writing = false;
      }
    };

    const schedule = () => {
      if (writing || scheduled) return;
      scheduled = window.requestAnimationFrame(sync);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });
    document.addEventListener("click", schedule, true);
    document.addEventListener("change", schedule, true);
    schedule();

    return () => {
      observer.disconnect();
      document.removeEventListener("click", schedule, true);
      document.removeEventListener("change", schedule, true);
      if (scheduled) window.cancelAnimationFrame(scheduled);
    };
  }, []);

  return null;
}
