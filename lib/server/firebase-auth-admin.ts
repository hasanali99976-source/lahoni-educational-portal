import "server-only";

import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

type ServiceAccountShape = {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
};

const APP_NAME = "lahooni-auth";

function serviceAccountFromEnvironment(): ServiceAccountShape | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    || process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT
    || process.env.FIREBASE_SERVICE_ACCOUNT;

  if (raw) {
    try {
      return JSON.parse(raw) as ServiceAccountShape;
    } catch (error) {
      console.error("invalid Firebase service-account JSON", error);
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  return projectId && clientEmail && privateKey
    ? { projectId, clientEmail, privateKey }
    : null;
}

function firebaseAuthApp(): App {
  const existing = getApps().find(app => app.name === APP_NAME);
  if (existing) return existing;

  const serviceAccount = serviceAccountFromEnvironment();
  if (serviceAccount) {
    const projectId = serviceAccount.project_id || serviceAccount.projectId || "tahdheeb-history";
    const clientEmail = serviceAccount.client_email || serviceAccount.clientEmail;
    const privateKey = (serviceAccount.private_key || serviceAccount.privateKey || "").replace(/\\n/g, "\n");
    if (!clientEmail || !privateKey) throw new Error("Firebase service-account credentials are incomplete");
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, APP_NAME);
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "tahdheeb-history",
  }, APP_NAME);
}

export async function createTeacherFirebaseToken(teacherId: string, subjectIds: string[]) {
  return getAuth(firebaseAuthApp()).createCustomToken(teacherId, {
    role: "teacher",
    subjectIds: [...new Set(subjectIds)],
  });
}
