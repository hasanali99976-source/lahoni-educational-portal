"use client";

import { useEffect } from "react";

const CSS = `
.home-v19{perspective:1800px!important;background:radial-gradient(circle at 8% 0%,rgba(60,199,213,.22),transparent 26%),linear-gradient(180deg,#f7fbfc,#edf4f6)!important}
.home-v19 .home-top{transform:translateZ(28px)!important;box-shadow:0 24px 55px rgba(6,47,69,.16),inset 0 1px #fff!important;border:1px solid rgba(255,255,255,.95)!important}
.home-v19 .home-hero{transform:perspective(1500px) rotateX(1.2deg) translateZ(12px)!important;box-shadow:0 46px 100px rgba(6,47,69,.34),inset 0 1px rgba(255,255,255,.16)!important;border:1px solid rgba(255,255,255,.12)!important}
.home-v19 .home-scene{transform:perspective(1200px) rotateY(-7deg) rotateX(2deg) translateZ(42px)!important;margin:20px!important;border-radius:30px!important;box-shadow:0 34px 74px rgba(0,0,0,.28)!important}
.home-v19 .portal-grid{perspective:1500px!important;gap:18px!important}
.home-v19 .portal-card{transform-style:preserve-3d!important;box-shadow:0 32px 64px rgba(8,48,68,.24),inset 0 1px rgba(255,255,255,.22)!important;border:1px solid rgba(255,255,255,.22)!important;min-height:220px!important}
.home-v19 .portal-card:nth-child(1){transform:rotateY(2deg) translateZ(18px)!important}.home-v19 .portal-card:nth-child(2){transform:translateZ(32px)!important}.home-v19 .portal-card:nth-child(3){transform:rotateY(-2deg) translateZ(18px)!important}
.home-v19 .portal-card:hover{transform:translateY(-14px) rotateX(3deg) rotateY(-2deg) translateZ(38px)!important;box-shadow:0 50px 90px rgba(8,48,68,.34)!important}
.home-v19 .portal-card .icon{transform:translateZ(38px)!important;box-shadow:0 16px 32px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.3)!important}
.home-v19 .subject-strip,.home-v19 .home-qr{box-shadow:0 24px 55px rgba(8,48,68,.14),inset 0 1px #fff!important;transform:translateZ(14px)!important}
.teacher-academy-v12 .academy-v12-rail{box-shadow:-34px 0 82px rgba(2,29,38,.30)!important}.teacher-dashboard-v16 :where(article,.td16-panel),.daily-report-page :where(.dr-table-wrap,.dr-kpis article,.daily-attendance-v300),.attendance-page :where(.attendance-card,.attendance-setup-panel,.attendance-workspace){box-shadow:0 24px 54px rgba(5,47,61,.16),inset 0 1px #fff!important;border:1px solid rgba(255,255,255,.92)!important}
.teacher-dashboard-v16 :where(article,.td16-panel):hover,.daily-report-page .dr-kpis article:hover{transform:translateY(-7px) scale(1.01)!important;box-shadow:0 38px 72px rgba(5,47,61,.22)!important}
.student-subject-choice-v300,.student-academy-v4 .sta4-card,.student-academy-v4 .sta4-subject-head,.student-academy-v4 .sta4-top{box-shadow:0 24px 54px rgba(5,47,61,.16),inset 0 1px #fff!important}
@media(max-width:760px){.home-v19 .home-hero,.home-v19 .home-scene,.home-v19 .portal-card:nth-child(n){transform:none!important}.home-v19 .portal-card:hover{transform:translateY(-5px)!important}}
`;

export default function PortalV302VisualRuntime(){
  useEffect(()=>{
    const id="lahooni-v302-visual-style";
    let style=document.getElementById(id) as HTMLStyleElement|null;
    if(!style){style=document.createElement("style");style.id=id;document.head.appendChild(style)}
    style.textContent=CSS;
    return()=>{};
  },[]);
  return null;
}
