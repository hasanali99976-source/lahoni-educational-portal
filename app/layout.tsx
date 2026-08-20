import "./globals.css";
import "./identity.css";
import "./print.css";
import "./student/subject.css";
import "./teacher/scientific-ai.css";
import "./ai-light-portal.css";
import "./portal-contrast.css";
import "./comfort-theme.css";
import "./teacher-tabs-redesign.css";
import "./educational-platform-v4.css";
import "./final-platform-overrides.css";
import "./subject-artwork.css";
import "./subject-scenes.css";
import "./subject-identity-v3.css";
import "./subject-worlds-v4.css";
import "./neon-ai-portal-v5.css";
import { Tajawal } from "next/font/google";
import type { Metadata, Viewport } from "next";
import PwaRegister from "./pwa-register";
import MobileAppEnhancer from "./mobile-app-enhancer";
import IntroSound from "./intro-sound";
import SmartLaunch from "./smart-launch";
import SmartTransition from "./smart-transition";
import SmartEduAssistant from "./smart-edu-assistant";
import PortalLabelSync from "./portal-label-sync";
import TeacherSubjectSwitcher from "./teacher-subject-switcher";

const tajawal = Tajawal({ subsets: ["arabic"], weight: ["400", "500", "700", "800", "900"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "أستاذ لحوني", template: "%s | أستاذ لحوني" },
  description: "منصة تعليمية ذكية للمتابعة والتقارير المدرسية",
  applicationName: "أستاذ لحوني",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "أستاذ لحوني", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/ostadh-lahooni-192.jpg", sizes: "192x192", type: "image/jpeg" }], apple: [{ url: "/icons/ostadh-lahooni-192.jpg", sizes: "192x192", type: "image/jpeg" }] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 5, viewportFit: "cover", themeColor: "#0b1d48", colorScheme: "dark light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body className={tajawal.className}>
    <div className="print-header">بوابة أستاذ لحوني التعليمية</div>
    <SmartLaunch /><SmartTransition /><PwaRegister /><MobileAppEnhancer /><IntroSound /><PortalLabelSync /><TeacherSubjectSwitcher />
    <div className="portal-stage">{children}</div>
    <SmartEduAssistant />
    <div className="print-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span className="page-number"/></div>
  </body></html>;
}
