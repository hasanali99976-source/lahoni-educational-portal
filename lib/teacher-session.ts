import "server-only";
import { createHash, timingSafeEqual } from "crypto";

export const TEACHER_COOKIE = "tahdheeb_teacher_session";

function teacherSecret() {
  return process.env.TEACHER_ACCESS_CODE || "1415";
}

export function teacherSessionToken() {
  return createHash("sha256").update(`tahdheeb:${teacherSecret()}`).digest("hex");
}

export function isTeacherCodeValid(code: string) {
  const expected = Buffer.from(teacherSecret());
  const received = Buffer.from(code);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function isTeacherSessionValid(value?: string) {
  if (!value) return false;
  const expected = Buffer.from(teacherSessionToken());
  const received = Buffer.from(value);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
