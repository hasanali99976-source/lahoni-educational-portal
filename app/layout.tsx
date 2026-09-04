import "./globals.css";
import "./print.css";
import "./attendance-students-v31.css";
import "./approved-entry.css";
import "./design-lab-v1.css";
import "./design-lab-home-3portals.css";
import "./design-lab-ai-home.css";
import "./design-lab-live-polish.css";
import { Tajawal } from "next/font/google";
import type { Metadata, Viewport } from "next";
import PwaRegister from "./pwa-register";
import MobileAppEnhancer from "./mobile-app-enhancer";
import MobileWindowBridge from "./mobile-window-bridge";
import PortalIntelligence from "./portal-intelligence";
import PortalCommandRuntime from "./portal-command-runtime";
import PortalRuntimeGate from "./portal-runtime-gate";
import DesignLabSmartAssist from "./design-lab-smart-assist";
import DesignLabPortalAccent from "./design-lab-portal-accent";

const tajawal = Tajawal({ subsets: ["arabic"], weight: ["400", "500", "700", "800", "900"], display: "swap" });

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
  return <html lang="ar" dir="rtl"><body className={tajawal.className}>
    <PwaRegister /><MobileWindowBridge /><MobileAppEnhancer />
    <PortalRuntimeGate>
      <div className="print-header">بوابة أستاذ لحوني التعليمية</div>
      <PortalIntelligence /><PortalCommandRuntime />
    </PortalRuntimeGate>
    <div className="portal-stage">{children}</div>
    <DesignLabPortalAccent />
    <DesignLabSmartAssist />
    <PortalRuntimeGate><div className="print-footer"><strong>بوابة أستاذ لحوني التعليمية</strong><span className="page-number"/></div></PortalRuntimeGate>
  </body></html>;
}
