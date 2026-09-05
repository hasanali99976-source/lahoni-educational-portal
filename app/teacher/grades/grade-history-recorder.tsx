"use client";

import { useEffect, useMemo, useRef } from "react";
import { arrayUnion, doc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useTeacherClient } from "../../../lib/teacher-client";
import { type ClientTenant, tenantStudentsPath } from "../../../lib/firestore-tenant-client";
import { gradeEntryKey, type GradePlan } from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";

type GradeValues = Record<string, number>;
type StudentRow = { id?: string; code?: string; name?: string; gradeValues?: GradeValues; gradePlanValues?: Record<string, GradeValues> };
type SnapshotRow = {
  studentId: string;
  studentName: string;
  recorded: boolean;
  value: number | null;
  sectionId: string;
  sectionLabel: string;
  itemId: string;
  itemLabel: string;
  maximum: number;
};
type Snapshot = Record<string, SnapshotRow>;

function valuesFor(student: StudentRow, plan: GradePlan) {
  return student.gradePlanValues?.[plan.id] || student.gradeValues || {};
}

function buildSnapshot(students: StudentRow[], plan: GradePlan): Snapshot {
  const out: Snapshot = {};
  for (const student of students) {
    const studentId = String(student.code || student.id || "").trim().toUpperCase();
    if (!studentId) continue;
    const values = valuesFor(student, plan);
    for (const section of plan.sections) {
      for (const item of section.items) {
        const key = gradeEntryKey(section.id, item.id);
        const recorded = Object.prototype.hasOwnProperty.call(values, key) && Number.isFinite(Number(values[key]));
        out[`${studentId}::${key}`] = {
          studentId,
          studentName: String(student.name || ""),
          recorded,
          value: recorded ? Number(values[key]) : null,
          sectionId: section.id,
          sectionLabel: section.label,
          itemId: item.id,
          itemLabel: item.label,
          maximum: item.max,
        };
      }
    }
  }
  return out;
}

export default function GradeHistoryRecorder() {
  const session = useTeacherClient();
  const { activePlan } = useGradePlan(true);
  const baseline = useRef<Snapshot>({});
  const busy = useRef(false);
  const tenant = useMemo<ClientTenant | null>(() => session.teacherId && session.subjectKey ? {
    teacherId: session.teacherId,
    teacherName: session.teacherName || "",
    subjectKey: session.subjectKey as never,
  } : null, [session.teacherId, session.teacherName, session.subjectKey]);

  useEffect(() => {
    if (!tenant || !activePlan) return;
    let cancelled = false;
    const fetchStudents = async () => {
      const params = new URLSearchParams({ subjectId: tenant.subjectKey });
      if (session.activeGrade) params.set("grade", String(session.activeGrade));
      const response = await fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      return Array.isArray(payload.students) ? payload.students as StudentRow[] : [];
    };

    void fetchStudents().then(rows => {
      if (!cancelled) baseline.current = buildSnapshot(rows, activePlan);
    }).catch(() => {});

    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest("button");
      if (!button || busy.current) return;
      const text = (button.textContent || "").replace(/\s+/g, " ").trim();
      if (!text.includes("حفظ التغييرات") && !text.includes("جارٍ الحفظ")) return;
      busy.current = true;
      const before = { ...baseline.current };

      window.setTimeout(async () => {
        try {
          const rows = await fetchStudents();
          const after = buildSnapshot(rows, activePlan);
          const now = new Date().toISOString();
          const writes: Promise<void>[] = [];

          for (const [snapKey, next] of Object.entries(after)) {
            const prev = before[snapKey];
            if (!prev) continue;
            const changed = prev.recorded !== next.recorded || (prev.recorded && next.recorded && next.value !== prev.value);
            if (!changed) continue;

            const changeType = !prev.recorded && next.recorded ? "added" : prev.recorded && !next.recorded ? "removed" : "changed";
            const beforeValue = prev.recorded ? prev.value : null;
            const afterValue = next.recorded ? next.value : null;
            const delta = Number(((afterValue || 0) - (beforeValue || 0)).toFixed(2));
            const eventId = `${activePlan.id}:${next.studentId}:${next.sectionId}:${next.itemId}:${now}`;

            writes.push(setDoc(doc(db, tenantStudentsPath(tenant), next.studentId), {
              gradeHistory: arrayUnion({
                id: eventId,
                planId: activePlan.id,
                planVersion: activePlan.version,
                teacherId: tenant.teacherId,
                teacherName: tenant.teacherName,
                subjectKey: tenant.subjectKey,
                studentName: next.studentName,
                sectionId: next.sectionId,
                sectionLabel: next.sectionLabel,
                itemId: next.itemId,
                itemLabel: next.itemLabel,
                maximum: next.maximum,
                before: beforeValue,
                after: afterValue,
                delta,
                changeType,
                changedAt: now,
              }),
              gradeHistoryUpdatedAt: now,
            }, { merge: true }) as Promise<void>);
          }

          if (writes.length) await Promise.all(writes);
          baseline.current = after;
        } catch (error) {
          console.error("grade-history-recorder", error);
        } finally {
          busy.current = false;
        }
      }, 1800);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      cancelled = true;
      document.removeEventListener("click", onClick, true);
    };
  }, [tenant, activePlan?.id, activePlan?.version, session.activeGrade]);

  return null;
}
