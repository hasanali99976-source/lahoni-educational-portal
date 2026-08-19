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
    // Canonical usernames only - session resolution will rely on teacherId stored in the session cookie
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

// New: token derived from teacherId (stable) + server secret
export function teacherSessionTokenForId(teacherId: string) {
  const secret = process.env.TEACHER_SESSION_SECRET || "lahoni-default-secret";
  return createHash("sha256").update(`tahdheeb:${teacherId}:${secret}`).digest("hex");
}

// Backwards compatible helper for existing flow (still available but not used for session parsing)
export function teacherSessionToken(account: TeacherAccount) {
  return createHash("sha256")
    .update(`tahdheeb:${account.teacherId}:${account.subjectKey}:${account.username}:${account.password}`)
    .digest("hex");
}

export function isTeacherCredentialsValid(username: string, password: string) {
  return !!findTeacherAccount(username, password);
}

// Parse the cookie value which is now expected to be base64(JSON({teacherId, token}))
export function teacherAccountFromSession(value?: string) {
  if (!value) return null;
  try {
    // Support new JSON cookie format
    const decoded = Buffer.from(value, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as { teacherId?: string; token?: string };
    if (parsed?.teacherId && parsed?.token) {
      const expected = teacherSessionTokenForId(parsed.teacherId);
      const received = parsed.token;
      const expectedBuf = Buffer.from(expected);
      const receivedBuf = Buffer.from(received);
      if (expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf)) {
        // return a minimal account-like object (username unknown here)
        const subjectKey = subjectKeyFromTeacherId(parsed.teacherId as string);
        const subject = getSubjectConfig(subjectKey).label;
        return { username: parsed.teacherId, password: "", teacherId: parsed.teacherId, subjectKey: subjectKey as SubjectKey, subject } as TeacherAccount;
      }
    }
  } catch (e) {
    // ignore and fall back to legacy check below
  }

  // Legacy fallback: try matching against in-memory accounts (keeps old sessions valid)
  return TEACHER_ACCOUNTS.find(account => {
    const expected = Buffer.from(teacherSessionToken(account));
    const received = Buffer.from(value);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }) || null;
}

export function isTeacherSessionValid(value?: string) {
  return !!teacherAccountFromSession(value);
}
