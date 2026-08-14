import "./globals.css";

export const metadata = {
  title: "بوابة التهذيب - مادة التاريخ",
  description: "نظام رصد درجات مادة التاريخ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
