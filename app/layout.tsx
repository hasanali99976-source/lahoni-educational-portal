import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Cairo, Tajawal } from "next/font/google";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
});

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "بوابة التهذيب التعليمية — مادة التاريخ",
  description:
    "نظام متابعة الحضور والدرجات والتقارير لمادة التاريخ في مدرسة التهذيب الثانوية — الأستاذ حسن علي الطويل.",
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${tajawal.variable} bg-app`}>
      <body>{children}</body>
    </html>
  );
}
