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
  const className=`academy-v12-home daily-report-direct-tab ${pathname.startsWith(HREF)?"active":""}`.trim();
  const html=`<span class="academy-v12-nav-icon" aria-hidden="true">▤</span><b>${TITLE}</b><i>غياب • تأخير • استئذان • هروب</i>`;
  if(link.className!==className)link.className=className;
  if(link.innerHTML!==html)link.innerHTML=html;
}

function ensureMobile(pathname:string){
  const nav=document.querySelector<HTMLElement>(".mobile-app-nav");
  if(!nav)return;
  let link=nav.querySelector<HTMLAnchorElement>('[data-daily-report-mobile="1"]');
  if(!link){
    link=document.createElement("a");
    link.href=HREF;
    link.dataset.dailyReportMobile="1";
    nav.appendChild(link);
  }
  const className=pathname.startsWith(HREF)?"active":"";
  const html=`<span class="mobile-nav-icon">▤</span><b>${TITLE}</b>`;
  if(link.className!==className)link.className=className;
  if(link.innerHTML!==html)link.innerHTML=html;
}

export default function TeacherDailyReportNavRuntime(){
  const pathname=usePathname();
  useEffect(()=>{
    if(!pathname.startsWith("/teacher")||pathname==="/teacher")return;
    const sync=()=>{ensureDesktop(pathname);ensureMobile(pathname)};
    sync();
    const timer1=window.setTimeout(sync,250);
    const timer2=window.setTimeout(sync,900);
    return()=>{window.clearTimeout(timer1);window.clearTimeout(timer2)};
  },[pathname]);
  return null;
}
