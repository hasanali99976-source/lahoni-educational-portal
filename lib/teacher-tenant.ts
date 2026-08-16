export type SubjectKey = "history" | "critical-thinking";

export type TeacherTenant = {
  teacherId: string;
  teacherName: string;
  subjectKey: SubjectKey;
  subjectLabel: string;
};

export function subjectKeyFromTeacherId(teacherId: string): SubjectKey {
  return teacherId === "abdullah-critical-thinking" ? "critical-thinking" : "history";
}

export function tenantRoot(teacherId: string, subjectKey: SubjectKey) {
  return `teacherData/${teacherId}/subjects/${subjectKey}`;
}

export function tenantCollection(teacherId: string, subjectKey: SubjectKey, collectionName: string) {
  return `${tenantRoot(teacherId, subjectKey)}/${collectionName}`;
}

export function tenantStudentId(nationalId: string, subjectKey: SubjectKey) {
  const cleanId = nationalId.replace(/\D/g, "");
  return `${subjectKey}__${cleanId}`;
}

export function isOwnedByTenant(
  value: { teacherId?: string; subjectKey?: string },
  tenant: Pick<TeacherTenant, "teacherId" | "subjectKey">,
) {
  return value.teacherId === tenant.teacherId && value.subjectKey === tenant.subjectKey;
}
