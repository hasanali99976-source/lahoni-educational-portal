"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const HREF="/teacher/daily-report";

function ensureDesktop(pathname:string){
  const home=document.querySelector<HTMLAnchorElement>(".academy-v12-home");
  if(!home||document.querySelector('[data-daily-report-tab="1"]'))return;
  const link=document.createElement("a");
  link.href=HREF;
  link.dataset.dailyReportTab="1";
  link.className=`academy-v12-home daily-report-direct-tab ${pathname.startsWith(HREF)?"active":""}`;
  link.innerHTML='<span class="academy-v12-nav-icon" aria-hidden="true">☀</span><b>اليوم</b><i>الغياب • التأخير • الهروب</i>';
  home.insertAdjacentElement("afterend",link);
}

function ensureMobile(pathname:string){
  const nav=document.querySelector<HTMLElement>(".mobile-app-nav");
  if(!nav||nav.querySelector('[data-daily-report-mobile="1"]'))return;
  const link=document.createElement("a");
  link.href=HREF;
  link.dataset.dailyReportMobile="1";
  link.className=pathname.startsWith(HREF)?"active":"";
  link.innerHTML='<span class="mobile-nav-icon">☀</span><b>اليوم</b>';
  nav.appendChild(link);
}

export default function TeacherDailyReportNavRuntime(){
  const pathname=usePathname();
  useEffect(()=>{
    if(!pathname.startsWith("/teacher")||pathname==="/teacher")return;
    const sync=()=>{ensureDesktop(pathname);ensureMobile(pathname)};
    sync();
    const observer=new MutationObserver(sync);
    observer.observe(document.body,{childList:true,subtree:true});
    const timer=window.setTimeout(sync,700);
    return()=>{observer.disconnect();window.clearTimeout(timer)};
  },[pathname]);
  return null;
}
