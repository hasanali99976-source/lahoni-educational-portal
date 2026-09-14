import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function readServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
        throw new Error("service account JSON is missing required fields");
      }
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key.replace(/\\n/g, "\n"),
      };
    } catch (error) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is invalid", { cause: error });
    }
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY.",
    );
  }

  return { projectId, clientEmail, privateKey };
}

function adminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const serviceAccount = readServiceAccount();
  return initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.projectId,
  });
}

export function adminDb() {
  return getFirestore(adminApp());
}

// لا نحمّل firebase-admin/auth مع كل Route تستخدم Firestore فقط.
// التحميل الكسول يمنع مشكلة ESM في Vercel ويُبقي مسارات الطالب/المعلم الخفيفة مستقلة.
export async function adminAuth() {
  const { getAuth } = await import("firebase-admin/auth");
  return getAuth(adminApp());
}
