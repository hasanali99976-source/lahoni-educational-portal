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
import "./global-font-v13.css";
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
import TeacherWorkActivityTracker from "./teacher-work-activity-tracker";

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
    <PwaRegister /><MobileWindowBridge /><MobileAppEnhancer />
    <PortalPrintRuntime />
    <PortalRuntimeGate>
      <div className="print-header">بوابة أستاذ لحوني التعليمية</div>
      <PortalCommandRuntime />
    </PortalRuntimeGate>
    <div className="portal-stage">{children}</div>
    <TeacherWorkActivityTracker />
    <DesignLabPortalAccent />
    <DesignLabSmartAssist />
    <PortalRuntimeGate><div className="print-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span className="page-number"/></div></PortalRuntimeGate>
  </body></html>;
}
