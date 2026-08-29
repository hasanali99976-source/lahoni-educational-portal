import "server-only";

import { createSign } from "node:crypto";

type ServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function serviceAccountFromEnvironment(): ServiceAccount | null {
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
        return {
          projectId: value.project_id,
          clientEmail: value.client_email,
          privateKey: value.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch (error) {
      console.warn("Firebase service account JSON is invalid", error);
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export async function createTeacherFirebaseToken(input: {
  teacherId: string;
  subjectIds: string[];
}) {
  const account = serviceAccountFromEnvironment();
  if (!account) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
    const payload = base64UrlJson({
      iss: account.clientEmail,
      sub: account.clientEmail,
      aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
      iat: now,
      exp: now + 3600,
      uid: input.teacherId,
      claims: {
        role: "teacher",
        subjectIds: input.subjectIds,
      },
    });
    const signingInput = `${header}.${payload}`;
    const signature = createSign("RSA-SHA256")
      .update(signingInput)
      .end()
      .sign(account.privateKey)
      .toString("base64url");

    return `${signingInput}.${signature}`;
  } catch (error) {
    console.warn("Firebase custom token creation skipped", error);
    return null;
  }
}
