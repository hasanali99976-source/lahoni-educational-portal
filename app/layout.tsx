import "./globals.css";
import "./print.css";
import "./attendance-students-v31.css";
import "./approved-entry.css";
import "./design-lab-v1.css";
import "./design-lab-home-3portals.css";
import "./design-lab-ai-home.css";
import "./design-lab-live-polish.css";
import "./design-lab-refine-v2.css";
import "./roster-pdf-v4.css";
import "./teacher/teacher-academy-v12-guards.css";
import "./teacher-academy-v13.css";
import "./teacher-academy-v14.css";
import "./teacher-academy-v15.css";
import "./teacher-academy-v16.css";
import "./teacher-academy-v17.css";
import "./teacher-academy-v19.css";
import "./global-font-v13.css";
import "./teacher-academy-v20.css";
import "./teacher-attendance-calendar-v21.css";
import "./student/academic-record/academic-record-v2.css";
import "./student-portal-academic-enhancer.css";
import "./student-subject-achievement-runtime.css";
import "./student-risk-center-runtime.css";
import "./platform-v200.css";
import "./platform-3d-v210.css";
import "./platform-3d-v220.css";
import "./platform-modern-v300.css";
import "./platform-modern-v301.css";
import { Alexandria } from "next/font/google";
import type { Metadata, Viewport } from "next";
import PwaRegister from "./pwa-register";
import MobileAppEnhancer from "./mobile-app-enhancer";
import MobileWindowBridge from "./mobile-window-bridge";
import PortalCommandRuntime from "./portal-command-runtime";
import PortalRuntimeGate from "./portal-runtime-gate";
import PortalPrintRuntime from "./portal-print-runtime";
import DesignLabSmartAssist from "./design-lab-smart-assist";
import DesignLabPortalAccent from "./design-lab-portal-accent";
import TeacherAttendanceScheduleNav from "./teacher-attendance-schedule-nav";
import TeacherAttendancePrintV21 from "./teacher-attendance-print-v21";
import TeacherGradesCleanRuntime from "./teacher-grades-clean-runtime";
import StudentAcademicRecordBridge from "./student-academic-record-bridge";
import StudentPortalAcademicEnhancer from "./student-portal-academic-enhancer";
import StudentSubjectAchievementRuntime from "./student-subject-achievement-runtime";
import StudentRiskCenterRuntime from "./student-risk-center-runtime";
import StudentAcademicRecordMaxRuntime from "./student-academic-record-max-runtime";
import StudentSmartNotesRuntime from "./student-smart-notes-runtime";
import TeacherNotesIdentityRuntime from "./teacher-notes-identity-runtime";
import AdminStudentEditClassRuntime from "./admin-student-edit-class-runtime";
import PortalVoiceGreetingRuntime from "./portal-voice-greeting-runtime";
import PortalV302VisualRuntime from "./portal-v302-visual-runtime";
import TeacherDailyReportNavRuntime from "./teacher-daily-report-nav-runtime";

const academyFont = Alexandria({ subsets: ["arabic"], weight: ["400", "500", "600", "700", "800", "900"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "أستاذ لحوني", template: "%s | أستاذ لحوني" },
  description: "منصة تعليمية ذكية للمتابعة والتقارير المدرسية",
  applicationName: "أستاذ لحوني",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "أستاذ لحوني", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/lahooni-identity-320.jpg", sizes: "320x320", type: "image/jpeg" },
    ],
    apple: [{ url: "/icons/lahooni-identity-320.jpg", sizes: "320x320", type: "image/jpeg" }],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 5, viewportFit: "cover", themeColor: "#073b45", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body className={academyFont.className}>
    <PwaRegister /><MobileWindowBridge /><MobileAppEnhancer /><PortalV302VisualRuntime /><TeacherDailyReportNavRuntime />
    <StudentAcademicRecordBridge /><StudentPortalAcademicEnhancer /><StudentSubjectAchievementRuntime /><StudentRiskCenterRuntime /><StudentAcademicRecordMaxRuntime /><StudentSmartNotesRuntime />
    <TeacherGradesCleanRuntime /><TeacherNotesIdentityRuntime /><AdminStudentEditClassRuntime />
    <PortalVoiceGreetingRuntime />
    <PortalPrintRuntime /><TeacherAttendanceScheduleNav /><TeacherAttendancePrintV21 />
    <PortalRuntimeGate>
      <div className="print-header">بوابة أستاذ لحوني التعليمية</div>
      <PortalCommandRuntime />
    </PortalRuntimeGate>
    <div className="portal-stage">{children}</div>
    <DesignLabPortalAccent />
    <DesignLabSmartAssist />
    <PortalRuntimeGate><div className="print-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span className="page-number"/></div></PortalRuntimeGate>
  </body></html>;
}
