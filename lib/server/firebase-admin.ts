import "server-only";

import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function normalizePrivateKey(value?: string) {
  return value?.replace(/\\n/g, "\n").trim();
}

function parseServiceAccountJson(raw?: string) {
  if (!raw) return null;
  try {
    const decoded = raw.trim().startsWith("{")
      ? raw.trim()
      : Buffer.from(raw.trim(), "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as {
      project_id?: string;
      projectId?: string;
      client_email?: string;
      clientEmail?: string;
      private_key?: string;
      privateKey?: string;
    };
    const projectId = parsed.project_id || parsed.projectId;
    const clientEmail = parsed.client_email || parsed.clientEmail;
    const privateKey = normalizePrivateKey(parsed.private_key || parsed.privateKey);
    return projectId && clientEmail && privateKey ? { projectId, clientEmail, privateKey } : null;
  } catch {
    return null;
  }
}

function createAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const jsonCredentials = parseServiceAccountJson(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  );

  const projectId =
    jsonCredentials?.projectId ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = jsonCredentials?.clientEmail || process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = jsonCredentials?.privateKey || normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (projectId && clientEmail && privateKey) {
    return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  }

  // Supports Google Application Default Credentials / workload identity when configured
  // in the hosting environment. Unlike the previous client SDK wrapper, Admin Firestore
  // never relies on browser Firestore security rules for trusted server routes.
  return initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) });
}

const adminApp = createAdminApp();
const firestore = getFirestore(adminApp);

export function adminDb() {
  return firestore;
}
