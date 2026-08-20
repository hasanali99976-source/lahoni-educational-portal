import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { getSubjectConfig, type SubjectKey } from "./subject-config";

export const TEACHER_COOKIE = "tahdheeb_teacher_session";
export const TEACHER_SESSION_MAX_AGE = 60 * 60 * 24; // 1 day

export type TeacherAccount = {
  username: string;
  password: string;
  teacherId: string;
  subjectKey: SubjectKey;
  subject: string;
};

const ACCOUNT_DEFINITIONS: Array<Omit<TeacherAccount, "subject">> = [
  {
    username: "حسن الطويل",
    password: "1415",
    teacherId: "hasan-history",
    subjectKey: "history",
  },
  {
    username: "عبد الله الرويشد",
    password: "1415",
    teacherId: "abdullah-critical-thinking",
    subjectKey: "critical-thinking",
  },
  {
    username: "فضل نعمان",
    password: "1415",
    teacherId: "fadl-naaman",
    subjectKey: "history",
  },
  {
    username: "أحمد الأحمد",
    password: "1415",
    teacherId: "ahmed-alahmad",
    subjectKey: "history",
  },
];

export const TEACHER_ACCOUNTS: TeacherAccount[] = ACCOUNT_DEFINITIONS.map(account => ({
  ...account,
  subject: getSubjectConfig(account.subjectKey).label,
}));

export function findTeacherAccount(username: string, password: string) {
  return TEACHER_ACCOUNTS.find(
    account => account.username === username.trim() && account.password === password,
  ) || null;
}

export function teacherSessionTokenForId(teacherId: string) {
  const secret = process.env.TEACHER_SESSION_SECRET || "lahoni-default-secret";
  return createHash("sha256").update(`tahdheeb:${teacherId}:${secret}`).digest("hex");
}

export function teacherSessionToken(account: TeacherAccount) {
  return createHash("sha256")
    .update(`tahdheeb:${account.teacherId}:${account.subjectKey}:${account.username}:${account.password}`)
    .digest("hex");
}

export function isTeacherCredentialsValid(username: string, password: string) {
  return !!findTeacherAccount(username, password);
}

export function teacherAccountFromSession(value?: string) {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as { teacherId?: string; token?: string };
    if (parsed?.teacherId && parsed?.token) {
      const expected = teacherSessionTokenForId(parsed.teacherId);
      const received = parsed.token;
      const expectedBuf = Buffer.from(expected);
      const receivedBuf = Buffer.from(received);
      if (expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf)) {
        return TEACHER_ACCOUNTS.find(account => account.teacherId === parsed.teacherId) || null;
      }
    }
  } catch {
    // Fall through to legacy session support.
  }

  return TEACHER_ACCOUNTS.find(account => {
    const expected = Buffer.from(teacherSessionToken(account));
    const received = Buffer.from(value);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }) || null;
}

export function isTeacherSessionValid(value?: string) {
  return !!teacherAccountFromSession(value);
}
