"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const TeacherAttendanceScheduleNav = dynamic(() => import("./teacher-attendance-schedule-nav"));
const TeacherAttendancePrintV21 = dynamic(() => import("./teacher-attendance-print-v21"));
const TeacherGradesCleanRuntime = dynamic(() => import("./teacher-grades-clean-runtime"));
const TeacherNotesIdentityRuntime = dynamic(() => import("./teacher-notes-identity-runtime"));
const TeacherDailyReportNavRuntime = dynamic(() => import("./teacher-daily-report-nav-runtime"));

const StudentAcademicRecordBridge = dynamic(() => import("./student-academic-record-bridge"));
const StudentPortalAcademicEnhancer = dynamic(() => import("./student-portal-academic-enhancer"));
const StudentSubjectAchievementRuntime = dynamic(() => import("./student-subject-achievement-runtime"));
const StudentRiskCenterRuntime = dynamic(() => import("./student-risk-center-runtime"));
const StudentAcademicRecordMaxRuntime = dynamic(() => import("./student-academic-record-max-runtime"));
const StudentSmartNotesRuntime = dynamic(() => import("./student-smart-notes-runtime"));

const AdminStudentEditClassRuntime = dynamic(() => import("./admin-student-edit-class-runtime"));

export default function RouteRuntimeLoader() {
  const pathname = usePathname();

  if (pathname === "/teacher") return null;
  if (pathname.startsWith("/teacher/attendance")) {
    return <><TeacherAttendanceScheduleNav /><TeacherAttendancePrintV21 /></>;
  }
  if (pathname.startsWith("/teacher/grades")) return <TeacherGradesCleanRuntime />;
  if (pathname.startsWith("/teacher/notes")) return <TeacherNotesIdentityRuntime />;
  if (pathname.startsWith("/teacher/daily-report")) return <TeacherDailyReportNavRuntime />;
  if (pathname.startsWith("/teacher")) return null;

  if (pathname.startsWith("/student")) {
    return (
      <>
        <StudentAcademicRecordBridge />
        <StudentPortalAcademicEnhancer />
        <StudentSubjectAchievementRuntime />
        <StudentRiskCenterRuntime />
        <StudentAcademicRecordMaxRuntime />
        <StudentSmartNotesRuntime />
      </>
    );
  }

  if (pathname.startsWith("/admin")) return <AdminStudentEditClassRuntime />;

  return null;
}
