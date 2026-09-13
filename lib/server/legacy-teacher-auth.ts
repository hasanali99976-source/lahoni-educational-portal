import "server-only";

import { verifyPassword } from "./password";

export const LEGACY_TEACHER_AUTH_VERSION = "legacy-teacher-fallback-v3";

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
    .replace(/\s+/g, " ");
}

const ACCOUNTS: Array<LegacyTeacherUser & { aliases: string[] }> = [
  {
    id: "hasan-history",
    username: "حسن الطويل",
    normalizedUsername: normalize("حسن الطويل"),
    name: "حسن علي الطويل",
    role: "teacher",
    passwordHash: "pbkdf2-sha512$210000$98125549bfb64588edc11c2c9f9b6b06$eb7dd9526b04ea9ad14135ec2952ca586a0b64f90bd3fc355bf2ebc8cdd7e47c",
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
    passwordHash: "pbkdf2-sha512$210000$89add99c35afb73e95f82a133645f15a$c9a54cfd43c2d935d462b3713bc7049c866e09fc9aa524702e384152aec09908",
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
    passwordHash: "pbkdf2-sha512$210000$efebb9573d4af762aba1e405529424cc$c850b0ccfd39d558868d2322dfa4d7e64f1907670435e6ece38eaeccd6220d1a",
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
    passwordHash: "pbkdf2-sha512$210000$18644707413ef9521e4770346f1a36db$d67d12145a925550dbcdf38594fdf73353915763a344c1c0534fd9c922186db0",
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
