"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const HREF="/teacher/daily-report";
const TITLE="سجل الانضباط";

function ensureDesktop(pathname:string){
  const home=document.querySelector<HTMLAnchorElement>(".academy-v12-home");
  if(!home)return;
  let link=document.querySelector<HTMLAnchorElement>('[data-daily-report-tab="1"]');
  if(!link){
    link=document.createElement("a");
    link.href=HREF;
    link.dataset.dailyReportTab="1";
    home.insertAdjacentElement("afterend",link);
  }
  link.className=`academy-v12-home daily-report-direct-tab ${pathname.startsWith(HREF)?"active":""}`;
  link.innerHTML=`<span class="academy-v12-nav-icon" aria-hidden="true">▤</span><b>${TITLE}</b><i>غياب • تأخير • استئذان • هروب</i>`;
}

function ensureMobile(pathname:string){
  const nav=document.querySelector<HTMLElement>(".mobile-app-nav");
  if(!nav)return;
  let link=nav.querySelector<HTMLAnchorElement>('[data-daily-report-mobile="1"]');
  if(!link){link=document.createElement("a");link.href=HREF;link.dataset.dailyReportMobile="1";nav.appendChild(link);}
  link.className=pathname.startsWith(HREF)?"active":"";
  link.innerHTML=`<span class="mobile-nav-icon">▤</span><b>${TITLE}</b>`;
}

export default function TeacherDailyReportNavRuntime(){
  const pathname=usePathname();
  useEffect(()=>{
    if(!pathname.startsWith("/teacher")||pathname==="/teacher")return;
    const sync=()=>{ensureDesktop(pathname);ensureMobile(pathname)};
    sync();
    const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});
    const timer=window.setTimeout(sync,700);
    return()=>{observer.disconnect();window.clearTimeout(timer)};
  },[pathname]);
  return null;
}
