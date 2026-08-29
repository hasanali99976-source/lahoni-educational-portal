import "./globals.css";
import "./print.css";
import "./subject-identities.css";
import "./attendance-students-v31.css";
import "./portal-new-era-v50.css";
import "./portal-new-era-login-v50.css";
import "./teacher-shell-fix-v51.css";
import { Tajawal } from "next/font/google";
import type { Metadata, Viewport } from "next";
import PwaRegister from "./pwa-register";
import MobileAppEnhancer from "./mobile-app-enhancer";
import PortalCommandRuntime from "./portal-command-runtime";
import TeacherNativeLogout from "./teacher-native-logout";
import DataSafetyGuard from "./data-safety-guard";

const tajawal = Tajawal({ subsets: ["arabic"], weight: ["400", "500", "700", "800", "900"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "أستاذ لحوني", template: "%s | أستاذ لحوني" },
  description: "منظومة تعليمية للمتابعة والإنجاز المدرسي",
  applicationName: "أستاذ لحوني",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "أستاذ لحوني", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/ostadh-lahooni-192.jpg", sizes: "192x192", type: "image/jpeg" }], apple: [{ url: "/icons/ostadh-lahooni-192.jpg", sizes: "192x192", type: "image/jpeg" }] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 5, viewportFit: "cover", themeColor: "#f4f1ea", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body className={tajawal.className}>
    <div className="print-header">بوابة أستاذ لحوني التعليمية</div>
    <PwaRegister /><MobileAppEnhancer /><PortalCommandRuntime /><TeacherNativeLogout /><DataSafetyGuard />
    <div className="portal-stage">{children}</div>
    <div className="print-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span className="page-number"/></div>
  </body></html>;
}
