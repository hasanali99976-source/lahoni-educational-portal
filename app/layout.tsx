import "./globals.css";
import "./print.css";
import "./portal-v3.css";
import "./login-v4.css";
import "./subject-identities.css";
import "./portal-experience-v4.css";
import "./full-portal-redesign-v5.css";
import "./portal-rebuild-v6.css";
import "./education-intelligence-v17.css";
import "./full-portal-overhaul-v18.css";
import "./portal-intelligence.css";
import "./attendance-students-v31.css";
import "./mobile-complete-v36.css";
import "./teacher/teacher-mobile-complete-v7.css";
import "./reference-design-v106.css";
import { Tajawal } from "next/font/google";
import type { Metadata, Viewport } from "next";
import PwaRegister from "./pwa-register";
import MobileAppEnhancer from "./mobile-app-enhancer";
import MobileWindowBridge from "./mobile-window-bridge";
import PortalIntelligence from "./portal-intelligence";
import PortalCommandRuntime from "./portal-command-runtime";
import PortalV105Runtime from "./portal-v105-runtime";
import TeacherRaceWidget from "./admin/teacher-race-widget";
import RosterImportWidget from "./admin/roster-import-widget";

const tajawal = Tajawal({ subsets: ["arabic"], weight: ["400", "500", "700", "800", "900"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "أستاذ لحوني", template: "%s | أستاذ لحوني" },
  description: "منصة تعليمية متكاملة لإدارة التعلم والمتابعة",
  applicationName: "أستاذ لحوني",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "أستاذ لحوني", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: [{ url: "/icons/ostadh-lahooni-192.jpg", sizes: "192x192", type: "image/jpeg" }], apple: [{ url: "/icons/ostadh-lahooni-192.jpg", sizes: "192x192", type: "image/jpeg" }] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 5, viewportFit: "cover", themeColor: "#102f50", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body className={tajawal.className}>
    <div className="print-header">بوابة أستاذ لحوني التعليمية</div>
    <PwaRegister /><MobileWindowBridge /><MobileAppEnhancer /><PortalIntelligence /><PortalCommandRuntime /><PortalV105Runtime /><TeacherRaceWidget /><RosterImportWidget />
    <div className="portal-stage">{children}</div>
    <div className="print-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span className="page-number"/></div>
  </body></html>;
}
