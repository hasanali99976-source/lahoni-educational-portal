import "./globals.css";
import "./print.css";
import { Tajawal } from "next/font/google";
import type { Metadata, Viewport } from "next";

const tajawal=Tajawal({subsets:["arabic"],weight:["400","500","700","800","900"],display:"swap"});

export const metadata:Metadata={
  title:{default:"بوابة أستاذ لحوني التعليمية",template:"%s | أستاذ لحوني"},
  description:"منصة تعليمية مدرسية موحدة للإدارة والمعلمين والطلاب",
  applicationName:"بوابة أستاذ لحوني التعليمية",
  manifest:"/manifest.webmanifest?v=2026-new-portal",
  appleWebApp:{capable:true,title:"أستاذ لحوني",statusBarStyle:"default"},
  formatDetection:{telephone:false},
  icons:{icon:[{url:"/icon.svg?v=2026-new-portal",type:"image/svg+xml"},{url:"/icons/lahooni-identity-320.jpg?v=2026-new-portal",sizes:"320x320",type:"image/jpeg"}],apple:[{url:"/icons/lahooni-identity-320.jpg?v=2026-new-portal",sizes:"320x320",type:"image/jpeg"}]}
};
export const viewport:Viewport={width:"device-width",initialScale:1,maximumScale:5,viewportFit:"cover",themeColor:"#061d2b",colorScheme:"light"};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="ar" dir="rtl"><body className={tajawal.className}>{children}</body></html>;
}
