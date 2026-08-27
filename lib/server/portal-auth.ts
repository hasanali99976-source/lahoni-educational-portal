import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { adminDb } from "./firebase-admin";

export const PORTAL_SESSION_COOKIE = "lahooni_portal_v2_session";
export const ADMIN_SESSION_COOKIE = "lahooni_admin_v2_session";
export const SESSION_MAX_AGE = 60 * 60 * 8;
export const ADMIN_SESSION_MAX_AGE = 60 * 30;

export type PortalRole = "admin" | "teacher";
export type PortalSession = {
  userId: string;
  role: PortalRole;
  name: string;
  authVersion: string;
  expiresAt: number;
};

export type PortalUser = {
  id: string;
  username: string;
  normalizedUsername: string;
  name: string;
  role: PortalRole;
  passwordHash: string;
  active: boolean;
  subjectIds: string[];
  assignments?: unknown;
  createdAt: string;
  updatedAt: string;
};

function secret() {
  const value = process.env.PORTAL_SESSION_SECRET;
  return value && value.length >= 32 ? value : "lahooni-portal-v2-session-signing-key-2026";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(session: PortalSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export type StudentAccess = { studentId: string; teacherId: string; subjectId: string; expiresAt: number };

export function createStudentAccessToken(access: StudentAccess) {
  const payload = Buffer.from(JSON.stringify(access)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readStudentAccessToken(value?: string): StudentAccess | null {
  if (!value) return null;
  try {
    const [payload, signature] = value.split(".");
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const access = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as StudentAccess;
    return access.expiresAt > Date.now() && access.studentId && access.teacherId && access.subjectId ? access : null;
  } catch {
    return null;
  }
}

export function readSessionToken(value?: string): PortalSession | null {
  if (!value) return null;
  try {
    const [payload, signature] = value.split(".");
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PortalSession;
    if (!session.userId || !session.role || !session.authVersion || session.expiresAt <= Date.now()) return null;
    if (session.role !== "admin" && session.role !== "teacher") return null;
    return session;
  } catch {
    return null;
  }
}

export async function currentSession(role?: PortalRole) {
  const store = await cookies();
  const cookieNames = role === "admin"
    ? [ADMIN_SESSION_COOKIE, PORTAL_SESSION_COOKIE]
    : role === "teacher"
      ? [PORTAL_SESSION_COOKIE]
      : [ADMIN_SESSION_COOKIE, PORTAL_SESSION_COOKIE];

  for (const cookieName of cookieNames) {
    const session = readSessionToken(store.get(cookieName)?.value);
    if (session && (!role || session.role === role)) return session;
  }
  return null;
}

export async function requireSession(role?: PortalRole) {
  const session = await currentSession(role);
  if (!session || (role && session.role !== role)) return null;
  const user = await findUserById(session.userId);
  if (!user || !user.active || user.role !== session.role) return null;
  if (session.role !== "admin" && (!user.updatedAt || user.updatedAt !== session.authVersion)) return null;
  return { ...session, name: user.name };
}

export function normalizeUsername(value: string) {
  return value.trim().toLocaleLowerCase("ar").replace(/\s+/g, " ");
}

export async function findUserByUsername(username: string): Promise<PortalUser | null> {
  const snapshot = await adminDb().collection("portalV2Users").where("normalizedUsername", "==", normalizeUsername(username)).limit(1).get();
  if (snapshot.empty) return null;
  const document = snapshot.docs[0]!;
  const data = document.data() as Omit<PortalUser, "id"> & { role?: string };
  if (data.role !== "admin" && data.role !== "teacher") return null;
  return { id: document.id, ...data, role: data.role };
}

export async function findUserById(id: string): Promise<PortalUser | null> {
  const document = await adminDb().collection("portalV2Users").doc(id).get();
  if (!document.exists) return null;
  const data = document.data() as Omit<PortalUser, "id"> & { role?: string };
  if (data.role !== "admin" && data.role !== "teacher") return null;
  return { id: document.id, ...data, role: data.role };
}
