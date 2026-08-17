"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import "./smart-transition.css";

const routes: Array<[string,string,string]> = [
  ["/teacher/dashboard","اللوحة الذكية","📊"],
  ["/teacher/portfolio","ملف الإنجاز","🏆"],
  ["/teacher/grades","رصد الدرجات","📈"],
  ["/teacher/research","رصد البحث","🔎"],
  ["/teacher/attendance","التحضير اليومي","✓"],
  ["/teacher/reports","ملخص الطالب","📄"],
  ["/teacher/follow-up","المتابعة والإتقان","🧠"],
  ["/teacher/students","إدارة الطلاب","👥"],
  ["/student","بوابة الطالب","🎓"],
  ["/teacher","بوابة المعلم","✦"],
];

function routeMeta(pathname:string){
  return routes.find(([path])=>pathname.startsWith(path)) || [pathname,"فتح الصفحة","✦"];
}

export default function SmartTransition(){
  const pathname=usePathname();
  const first=useRef(true);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const[visible,setVisible]=useState(false);
  const[label,setLabel]=useState("فتح الصفحة");
  const[icon,setIcon]=useState("✦");

  useEffect(()=>{
    if(first.current){first.current=false;return}
    const[,nextLabel,nextIcon]=routeMeta(pathname);
    setLabel(nextLabel);setIcon(nextIcon);setVisible(true);
    if(timer.current)clearTimeout(timer.current);
    const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current=setTimeout(()=>setVisible(false),reduce?180:520);
    return()=>{if(timer.current)clearTimeout(timer.current)};
  },[pathname]);

  if(!visible)return null;
  return <div className="smart-transition" role="status" aria-live="polite">
    <div className="transition-window">
      <span className="transition-scan"/>
      <div className="transition-icon">{icon}<i/></div>
      <div><small>انتقال ذكي</small><strong>جارٍ فتح {label}</strong><span>تجهيز الأدوات والبيانات...</span></div>
      <b className="transition-progress"/>
    </div>
  </div>;
}
