import "server-only";

import { verifyPassword } from "./password";

export const LEGACY_TEACHER_AUTH_VERSION = "legacy-teacher-fallback-v1";

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
  return value.trim().toLocaleLowerCase("ar").replace(/^أ\.\s*/, "").replace(/\s+/g, " ");
}

const ACCOUNTS: Array<LegacyTeacherUser & { aliases: string[] }> = [
  {
    id: "hasan-history",
    username: "حسن الطويل",
    normalizedUsername: normalize("حسن الطويل"),
    name: "حسن علي الطويل",
    role: "teacher",
    passwordHash: "pbkdf2-sha512$210000$cb5b0f92abd1882e2604305e8a19d8dc$c537cc8838aaf0e737f38b6491a8ec5f9a9d939d5a72aa3472f428cd9c6cf42a",
    active: true,
    subjectIds: ["history"],
    assignments: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: LEGACY_TEACHER_AUTH_VERSION,
    aliases: ["حسن الطويل", "حسن علي الطويل", "أ. حسن علي الطويل"],
  },
  {
    id: "abdullah-critical-thinking",
    username: "عبد الله الرويشد",
    normalizedUsername: normalize("عبد الله الرويشد"),
    name: "عبد الله الرويشد",
    role: "teacher",
    passwordHash: "pbkdf2-sha512$210000$d967b1206fd8f06cdc59bb1f3dbd43c6$db7b6a226f10ab0c4fb11d3d949cc2b0c89a52ef0282a0088c54297e7e7565ad",
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
    passwordHash: "pbkdf2-sha512$210000$8c456898195b4ce03a082b8edbb77c0b$9fd6a964dcdb39f5b4952318eb45df33f6fcb6e1f5df52c947a250f8296d6379",
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
    passwordHash: "pbkdf2-sha512$210000$e083c37dc7df5cc45b613951b9fb5a0a$56cb7e278b2ee8aa64b8edccc3f986c832fd5c01427ccb7474c5f022f1044c64",
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
