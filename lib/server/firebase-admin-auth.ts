import "server-only";

import { applicationDefault, cert, getApp, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let cachedApp: App | null | undefined;

function serviceAccountFromEnvironment() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (encoded) {
    try {
      const raw = encoded.startsWith("{")
        ? encoded
        : Buffer.from(encoded, "base64").toString("utf8");
      const value = JSON.parse(raw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (value.project_id && value.client_email && value.private_key) {
        return cert({
          projectId: value.project_id,
          clientEmail: value.client_email,
          privateKey: value.private_key.replace(/\\n/g, "\n"),
        });
      }
    } catch (error) {
      console.warn("Firebase service account JSON is invalid", error);
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();
  return null;
}

function portalAdminApp() {
  if (cachedApp !== undefined) return cachedApp;

  try {
    cachedApp = getApp("portal-auth");
    return cachedApp;
  } catch {
    // The named app has not been initialized yet.
  }

  const credential = serviceAccountFromEnvironment();
  if (!credential) {
    cachedApp = null;
    return null;
  }

  cachedApp = initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID || "tahdheeb-history",
  }, "portal-auth");
  return cachedApp;
}

export async function createTeacherFirebaseToken(input: {
  teacherId: string;
  subjectIds: string[];
}) {
  const app = portalAdminApp();
  if (!app) return null;

  try {
    return await getAuth(app).createCustomToken(input.teacherId, {
      role: "teacher",
      subjectIds: input.subjectIds,
    });
  } catch (error) {
    console.warn("Firebase custom token creation skipped", error);
    return null;
  }
}
