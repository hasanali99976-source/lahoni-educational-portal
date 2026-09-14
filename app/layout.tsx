import "./globals.css";
import "./print.css";
import "./portal-v3.css";
import "./portal-identity-v103.css";
import "./teacher/teacher-classic-v103.css";
import { Alexandria } from "next/font/google";
import type { Metadata, Viewport } from "next";
import PwaRegister from "./pwa-register";
import MobileAppEnhancer from "./mobile-app-enhancer";
import MobileWindowBridge from "./mobile-window-bridge";
import PortalCommandRuntime from "./portal-command-runtime";
import PortalRuntimeGate from "./portal-runtime-gate";
import PortalPrintRuntime from "./portal-print-runtime";
import PortalVoiceGreetingRuntime from "./portal-voice-greeting-runtime";
import RouteRuntimeLoader from "./route-runtime-loader";

const academyFont = Alexandria({ subsets: ["arabic"], weight: ["400", "500", "600", "700", "800", "900"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "أستاذ لحوني", template: "%s | أستاذ لحوني" },
  description: "منصة تعليمية ذكية للمتابعة والتقارير المدرسية",
  applicationName: "أستاذ لحوني",
  manifest: "/manifest.webmanifest?v=125-stable",
  appleWebApp: { capable: true, title: "أستاذ لحوني", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon.svg?v=125-stable", type: "image/svg+xml" },
      { url: "/icons/lahooni-identity-320.jpg?v=125-stable", sizes: "320x320", type: "image/jpeg" },
    ],
    apple: [{ url: "/icons/lahooni-identity-320.jpg?v=125-stable", sizes: "320x320", type: "image/jpeg" }],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 5, viewportFit: "cover", themeColor: "#0b2f57", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body className={academyFont.className}>
    <PwaRegister /><MobileWindowBridge /><MobileAppEnhancer />
    <RouteRuntimeLoader />
    <PortalVoiceGreetingRuntime />
    <PortalPrintRuntime />
    <PortalRuntimeGate>
      <div className="print-header">بوابة أستاذ لحوني التعليمية</div>
      <PortalCommandRuntime />
    </PortalRuntimeGate>
    <div className="portal-stage">{children}</div>
    <PortalRuntimeGate><div className="print-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span className="page-number"/></div></PortalRuntimeGate>
  </body></html>;
}