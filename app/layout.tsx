import "./globals.css";
import "./identity.css";
import "./print.css";
import "./student/subject.css";
import "./teacher/scientific-ai.css";
import "./ai-light-portal.css";
import "./portal-contrast.css";
import { Tajawal } from "next/font/google";
import type { Metadata, Viewport } from "next";
import PwaRegister from "./pwa-register";
import IntroSound from "./intro-sound";
import SmartLaunch from "./smart-launch";
import SmartTransition from "./smart-transition";
import SmartEduAssistant from "./smart-edu-assistant";
import PortalLabelSync from "./portal-label-sync";

const tajawal = Tajawal({ subsets: ["arabic"], weight: ["400", "500", "700", "800", "900"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "أستاذ لحوني", template: "%s | أستاذ لحوني" },
  description: "منصة تعليمية ذكية للمتابعة والتقارير المدرسية",
  applicationName: "أستاذ لحوني",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "أستاذ لحوني", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/ostadh-lahooni-192.jpg", sizes: "192x192", type: "image/jpeg" }], apple: [{ url: "/icons/ostadh-lahooni-192.jpg", sizes: "192x192", type: "image/jpeg" }] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#6557e8", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body className={tajawal.className}><div className="print-header">بوابة أستاذ لحوني التعليمية</div><SmartLaunch /><SmartTransition /><PwaRegister /><IntroSound /><PortalLabelSync />{children}<SmartEduAssistant /><div className="print-footer"><span className="page-number"/></div></body></html>;
}
