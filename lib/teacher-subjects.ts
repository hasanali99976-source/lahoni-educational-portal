import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { getSubjectConfig } from "./subject-config";

export type TeacherSubject = {
  teacherId: string;
  subjectId: string;
  subjectName: string;
  grade?: string;
  classSections?: string[];
  imageUrl?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export async function ensureTeacherSubject(teacherId: string, subjectId: string) {
  const ref = doc(db, `teachers/${teacherId}/subjects`, subjectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      teacherId,
      subjectId,
      subjectName: getSubjectConfig(subjectId).label,
      grade: "",
      classSections: [],
      imageUrl: "",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
}

export async function listTeacherSubjects(teacherId: string, includeInactive = false): Promise<TeacherSubject[]> {
  const col = collection(db, `teachers/${teacherId}/subjects`);
  const snap = await getDocs(col);
  const subjects = snap.docs.map((item) => ({ subjectId: item.id, ...(item.data() as TeacherSubject) }));
  return includeInactive ? subjects : subjects.filter((subject) => subject.isActive !== false);
}
