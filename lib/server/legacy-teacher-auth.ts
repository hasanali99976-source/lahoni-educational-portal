import "server-only";

import { verifyPassword } from "./password";

export const LEGACY_TEACHER_AUTH_VERSION = "legacy-teacher-fallback-v4";

export type LegacyTeacherUser = {
  id: string;
  username: string;
  normalizedUsername: string;
  name: string;
  role: "teacher";
  passwordHash: string;
  active: boolean;
  subjectIds: string[];
  assignments: unknown[];
  createdAt: string;
  updatedAt: string;
};

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ar")
    .replace(/^أ\.\s*/, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ـ\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ");
}

const ACCOUNTS: Array<LegacyTeacherUser & { aliases: string[] }> = [
  {
    id: "hasan-history",
    username: "حسن الطويل",
    normalizedUsername: normalize("حسن الطويل"),
    name: "حسن علي الطويل",
    role: "teacher",
    passwordHash: "pbkdf2-sha512$210000$98125549bfb64588edc11c2c9f9b6b06$ae4f9e36ea0358ab04cc0b2b99b44e8f96d7d972e3ffe73fa3ee35889693ea51",
    active: true,
    subjectIds: ["history"],
    assignments: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: LEGACY_TEACHER_AUTH_VERSION,
    aliases: ["حسن الطويل", "حسن علي الطويل", "أ. حسن علي الطويل", "حسن علي", "حسن"],
  },
  {
    id: "abdullah-critical-thinking",
    username: "عبد الله الرويشد",
    normalizedUsername: normalize("عبد الله الرويشد"),
    name: "عبد الله الرويشد",
    role: "teacher",
    passwordHash: "pbkdf2-sha512$210000$89add99c35afb73e95f82a133645f15a$d161e9e1ee2de9ae7d984d26a7e95ba28fda354e2671de5684c812c7516c346c",
    active: true,
    subjectIds: ["critical-thinking"],
    assignments: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: LEGACY_TEACHER_AUTH_VERSION,
    aliases: ["عبد الله الرويشد", "عبدالله الرويشد"],
  },
  {
    id: "fadl-naaman",
    username: "فضل نعمان",
    normalizedUsername: normalize("فضل نعمان"),
    name: "فضل نعمان",
    role: "teacher",
    passwordHash: "pbkdf2-sha512$210000$efebb9573d4af762aba1e405529424cc$6f93437a7019012be91802c8d420c8394c6a820ef79ae79dff4ac803d31853ac",
    active: true,
    subjectIds: ["history"],
    assignments: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: LEGACY_TEACHER_AUTH_VERSION,
    aliases: ["فضل نعمان"],
  },
  {
    id: "ahmed-alahmad",
    username: "أحمد الأحمد",
    normalizedUsername: normalize("أحمد الأحمد"),
    name: "أحمد الأحمد",
    role: "teacher",
    passwordHash: "pbkdf2-sha512$210000$18644707413ef9521e4770346f1a36db$cb2ea5ad298c80157efab9cf7957096e53549f68c7692f5a6c0cfc898c2b75dd",
    active: true,
    subjectIds: ["history"],
    assignments: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: LEGACY_TEACHER_AUTH_VERSION,
    aliases: ["أحمد الأحمد"],
  },
];

function publicUser(account: (typeof ACCOUNTS)[number]): LegacyTeacherUser {
  const { aliases: _aliases, ...user } = account;
  return user;
}

export function findLegacyTeacherByCredentials(username: string, password: string): LegacyTeacherUser | null {
  const key = normalize(username);
  const account = ACCOUNTS.find(item => item.aliases.some(alias => normalize(alias) === key));
  if (!account || !verifyPassword(password, account.passwordHash)) return null;
  return publicUser(account);
}

export function legacyTeacherById(id: string): LegacyTeacherUser | null {
  const account = ACCOUNTS.find(item => item.id === id);
  return account ? publicUser(account) : null;
}
