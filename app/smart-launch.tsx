"use client";

import { useEffect, useState } from "react";
import "./smart-launch.css";

export default function SmartLaunch(){
  const[visible,setVisible]=useState(true);
  useEffect(()=>{
    const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer=window.setTimeout(()=>setVisible(false),reduce?350:1850);
    return()=>window.clearTimeout(timer);
  },[]);
  if(!visible)return null;
  return <div className="smart-launch" role="status" aria-label="جارٍ تشغيل البوابة">
    <div className="launch-grid"/>
    <div className="launch-glow glow-one"/><div className="launch-glow glow-two"/>
    <div className="launch-orbit orbit-one"/><div className="launch-orbit orbit-two"/>
    <div className="launch-core">
      <span className="launch-pulse"/>
      <img src="/icons/ostadh-lahooni-192.jpg" alt="أيقونة أستاذ لحوني"/>
      <span className="launch-scan"/>
    </div>
    <div className="launch-signal signal-a">📚</div>
    <div className="launch-signal signal-b">📊</div>
    <div className="launch-signal signal-c">🧠</div>
    <div className="launch-signal signal-d">✓</div>
    <div className="launch-copy"><strong>أستاذ لحوني</strong><span>تجهيز تجربة تعليمية ذكية</span><i><b/></i></div>
  </div>
}
