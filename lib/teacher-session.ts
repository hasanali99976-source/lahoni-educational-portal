import "server-only";
import { createHash, timingSafeEqual } from "crypto";

export const TEACHER_COOKIE = "tahdheeb_teacher_session";
export const TEACHER_SESSION_MAX_AGE = 60 * 10;

function teacherUsername() {
  return process.env.TEACHER_USERNAME || "حسن الطويل";
}

function teacherSecret() {
  return process.env.TEACHER_PASSWORD || process.env.TEACHER_ACCESS_CODE || "1415";
}

export function teacherSessionToken() {
  return createHash("sha256").update(`tahdheeb:${teacherUsername()}:${teacherSecret()}`).digest("hex");
}

export function isTeacherCredentialsValid(username: string, password: string) {
  const expectedUsername = Buffer.from(teacherUsername());
  const receivedUsername = Buffer.from(username);
  const expectedPassword = Buffer.from(teacherSecret());
  const receivedPassword = Buffer.from(password);
  return expectedUsername.length === receivedUsername.length && timingSafeEqual(expectedUsername, receivedUsername)
    && expectedPassword.length === receivedPassword.length && timingSafeEqual(expectedPassword, receivedPassword);
}

export function isTeacherSessionValid(value?: string) {
  if (!value) return false;
  const expected = Buffer.from(teacherSessionToken());
  const received = Buffer.from(value);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
