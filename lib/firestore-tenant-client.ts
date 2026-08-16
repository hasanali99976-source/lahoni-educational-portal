import { collection, doc, Firestore, getDocs, writeBatch } from "firebase/firestore";
import { SubjectKey, tenantCollection, tenantStudentId } from "./teacher-tenant";

export type ClientTenant = {
  teacherId: string;
  teacherName: string;
  subjectKey: SubjectKey;
};

export function tenantStudentsPath(tenant: ClientTenant) {
  return tenantCollection(tenant.teacherId, tenant.subjectKey, "students");
}

export function tenantClassesPath(tenant: ClientTenant) {
  return tenantCollection(tenant.teacherId, tenant.subjectKey, "classes");
}

/**
 * Copies legacy history students into Hasan's isolated tenant path.
 * Legacy documents are never deleted. Existing tenant documents are merged.
 */
export async function migrateLegacyHistoryStudents(db: Firestore, tenant: ClientTenant) {
  if (tenant.teacherId !== "hasan-history" || tenant.subjectKey !== "history") return;

  const isolated = await getDocs(collection(db, tenantStudentsPath(tenant)));
  if (!isolated.empty) return;

  const legacy = await getDocs(collection(db, "students"));
  const candidates = legacy.docs.filter(item => {
    const value = item.data() as { teacherId?: string; subjectKey?: string };
    const subjectKey = value.subjectKey || (!value.teacherId ? "history" : "");
    return subjectKey === "history" && (!value.teacherId || value.teacherId === "hasan-history");
  });
  if (!candidates.length) return;

  const batch = writeBatch(db);
  for (const item of candidates) {
    const value = item.data() as Record<string, unknown> & { nationalId?: string };
    const nationalId = String(value.nationalId || item.id).replace(/\D/g, "");
    if (!nationalId) continue;
    batch.set(
      doc(db, tenantStudentsPath(tenant), tenantStudentId(nationalId, tenant.subjectKey)),
      { ...value, nationalId, teacherId: tenant.teacherId, teacherName: tenant.teacherName, subjectKey: tenant.subjectKey },
      { merge: true },
    );
  }
  await batch.commit();
}
