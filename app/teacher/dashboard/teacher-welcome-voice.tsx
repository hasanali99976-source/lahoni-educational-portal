"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";

const VOICE_KEY="lahooni.teacher.welcome.session.v4";

export default function TeacherWelcomeVoice(){
  const session=useTeacherClient();
  const [needsTap,setNeedsTap]=useState(false);
  const [speaking,setSpeaking]=useState(false);
  const startedRef=useRef(false);

  const speak=useCallback((force=false)=>{
    const name=String(session.teacherName||"").trim();
    if(!name||typeof window==="undefined"||!("speechSynthesis" in window))return;
    const identity=String(session.teacherId||name);
    if(!force&&sessionStorage.getItem(VOICE_KEY)===identity)return;
    try{
      startedRef.current=false;
      window.speechSynthesis.cancel();
      const utterance=new SpeechSynthesisUtterance(`مرحباً أستاذ ${name}. أهلاً بك في بوابة أستاذ لحوني التعليمية. نتمنى لك يوماً تعليمياً موفقاً ومؤثراً.`);
      utterance.lang="ar-SA";utterance.rate=.9;utterance.pitch=1;
      const chooseVoice=()=>{const voices=window.speechSynthesis.getVoices();utterance.voice=voices.find(v=>/^ar-SA/i.test(v.lang))||voices.find(v=>/^ar/i.test(v.lang))||null;};
      chooseVoice();
      utterance.onstart=()=>{startedRef.current=true;setNeedsTap(false);setSpeaking(true);sessionStorage.setItem(VOICE_KEY,identity);};
      utterance.onend=()=>setSpeaking(false);
      utterance.onerror=()=>{setSpeaking(false);setNeedsTap(true);};
      window.speechSynthesis.speak(utterance);
      window.setTimeout(()=>{if(!startedRef.current&&!window.speechSynthesis.speaking)setNeedsTap(true);},1200);
    }catch{setNeedsTap(true);setSpeaking(false);}
  },[session.teacherId,session.teacherName]);

  useEffect(()=>{
    const timer=window.setTimeout(()=>speak(false),450);
    const resume=()=>{if(needsTap||!startedRef.current)speak(false);};
    window.addEventListener("pointerdown",resume,{once:true});
    window.addEventListener("keydown",resume,{once:true});
    window.speechSynthesis?.addEventListener?.("voiceschanged",resume,{once:true});
    return()=>{window.clearTimeout(timer);window.removeEventListener("pointerdown",resume);window.removeEventListener("keydown",resume);window.speechSynthesis?.removeEventListener?.("voiceschanged",resume);};
  },[speak,needsTap]);

  return <button type="button" className={`teacher-welcome-voice ${needsTap?"needs-tap":""} ${speaking?"speaking":""}`} onClick={()=>speak(true)} aria-label="تشغيل رسالة الترحيب الصوتية" title="تشغيل رسالة الترحيب الصوتية"><span aria-hidden="true">🔊</span><b>{speaking?"مرحبًا بك":needsTap?"تشغيل الترحيب":"الترحيب الصوتي"}</b><style jsx global>{`.teacher-welcome-voice{position:fixed;left:20px;bottom:20px;z-index:150;display:flex;align-items:center;gap:8px;height:44px;padding:0 13px;border:1px solid #d5e2e7;border-radius:14px;background:#fff;color:#244754;box-shadow:0 12px 30px rgba(20,55,72,.13);font-family:"Tajawal","Segoe UI",Tahoma,Arial,sans-serif;cursor:pointer}.teacher-welcome-voice span{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:#edf5f7}.teacher-welcome-voice b{font-size:10px}.teacher-welcome-voice.needs-tap{background:linear-gradient(135deg,#173e50,#0b7772);color:#fff;border-color:transparent}.teacher-welcome-voice.needs-tap span{background:rgba(255,255,255,.12)}.teacher-welcome-voice.speaking span{animation:welcomePulse 1s infinite}@keyframes welcomePulse{50%{transform:scale(1.12)}}@media(max-width:820px){.teacher-welcome-voice{left:12px;bottom:12px}.teacher-welcome-voice b{display:none}}`}</style></button>;
}
