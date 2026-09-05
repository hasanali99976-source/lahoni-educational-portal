"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import "./admin-student-edit-class-runtime.css";

type SchoolClass = { id: string; grade: number; section: string; name: string; active?: boolean };

function setReactInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function AdminStudentEditClassRuntime() {
  const pathname = usePathname();
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  useEffect(() => {
    if (pathname !== "/admin/students") return;
    let active = true;
    fetch("/api/admin/students", { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => { if (active) setClasses(Array.isArray(data.classes) ? data.classes : []); })
      .catch(() => {});
    return () => { active = false; };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/admin/students" || !classes.length) return;
    let timer = 0;
    const enhance = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const modals = [...document.querySelectorAll<HTMLElement>(".roster-v3-modal")];
        const modal = modals.find(node => node.querySelector("h2")?.textContent?.includes("تعديل أو نقل الطالب"));
        if (!modal || modal.querySelector(".admin-class-smart-select")) return;
        const labels = [...modal.querySelectorAll<HTMLLabelElement>("label")];
        const gradeLabel = labels.find(label => label.textContent?.trim().startsWith("الصف"));
        const sectionLabel = labels.find(label => label.textContent?.trim().startsWith("رقم الفصل"));
        const gradeSelect = gradeLabel?.querySelector("select") as HTMLSelectElement | null;
        const sectionInput = sectionLabel?.querySelector("input") as HTMLInputElement | null;
        if (!gradeSelect || !sectionInput || !sectionLabel) return;

        sectionInput.style.display = "none";
        const select = document.createElement("select");
        select.className = "admin-class-smart-select";
        const hint = document.createElement("small");
        hint.className = "admin-class-smart-hint";
        hint.textContent = "اختر الفصل من الفصول المسجلة بدل كتابة الرقم يدويًا.";
        sectionLabel.appendChild(select);
        sectionLabel.appendChild(hint);

        const refresh = () => {
          const grade = Number(gradeSelect.value || 0);
          const options = classes.filter(item => Number(item.grade) === grade && item.active !== false).sort((a,b)=>Number(a.section)-Number(b.section));
          const current = sectionInput.value;
          select.innerHTML = "";
          options.forEach(item => {
            const option = document.createElement("option");
            option.value = String(item.section);
            option.textContent = item.name || `فصل ${item.section}`;
            select.appendChild(option);
          });
          if (options.some(item => String(item.section) === current)) select.value = current;
          else if (options[0]) { select.value = String(options[0].section); setReactInputValue(sectionInput, select.value); }
        };

        select.addEventListener("change", () => setReactInputValue(sectionInput, select.value));
        gradeSelect.addEventListener("change", () => window.setTimeout(refresh, 0));
        refresh();
      }, 20);
    };
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, [pathname, classes]);

  return null;
}
