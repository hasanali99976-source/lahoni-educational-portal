import "./globals.css";
import { Tajawal } from "next/font/google";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
});

export const metadata = {
  title: "بوابة التهذيب - مادة التاريخ",
  description: "نظام رصد درجات مادة التاريخ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={tajawal.className}>{children}</body>
    </html>
  );
}
