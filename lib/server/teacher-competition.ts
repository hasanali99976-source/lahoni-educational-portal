import "server-only";

/**
 * Teacher competition has been retired to protect the Firestore free quota.
 * Keep this compatibility stub so legacy admin/report imports cannot trigger
 * broad teacher/subject scans and do not break production builds.
 */
export type TeacherCompetitionRow = {
  teacherId: string;
  teacherName: string;
  active: boolean;
  accountCreatedAt: string;
  score: number;
  meaningfulActions: number;
  activeDays: number;
  rank: number;
};

export async function buildTeacherCompetition(_: { force?: boolean } = {}) {
  return {
    period: null,
    current: null,
    leader: null,
    ahead: null,
    gapToAhead: 0,
    progressToLeader: 0,
    totalTeachers: 0,
    topThree: [] as TeacherCompetitionRow[],
    rows: [] as TeacherCompetitionRow[],
    rule: null,
    disabled: true,
  };
}
