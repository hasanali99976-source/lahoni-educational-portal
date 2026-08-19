import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { getSubjectConfig } from "./subject-config";

export type TeacherSubject = { teacherId: string; subjectId: string; subjectName: string };

export async function ensureTeacherSubject(teacherId: string, subjectId: string) {
  const ref = doc(db, `teachers/${teacherId}/subjects`, subjectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      teacherId,
      subjectId,
      subjectName: getSubjectConfig(subjectId).label,
      createdAt: new Date().toISOString(),
    }, { merge: true });
  }
}

export async function listTeacherSubjects(teacherId: string): Promise<TeacherSubject[]> {
  const col = collection(db, `teachers/${teacherId}/subjects`);
  const snap = await getDocs(col);
  return snap.docs.map(d => d.data() as TeacherSubject);
}
