"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

type PortalVoiceGreetingProps={role:"teacher"|"student";name?:string;identityKey?:string;compact?:boolean};
type NativeSpeechBridge={speakArabic?:(text:string)=>void;stopSpeech?:()=>void;isSpeechReady?:()=>boolean};
declare global{interface Window{OstadhTts?:{speakArabic?:(text:string)=>void;stopSpeech?:()=>void;isReady?:()=>boolean};__OSTADH_ANDROID__?:boolean}}

function cleanName(value?:string){
  const name=String(value||"").trim().replace(/^(الأستاذ|استاذ|أستاذ|المعلم|الطالب|أ\.)\s*/u,"").replace(/\s+/g," ").trim();
  if(!name||["المعلم","الطالب","مستخدم"].includes(name))return "";
  const parts=name.split(" ");return parts.filter((part,index)=>index===0||part!==parts[index-1]).join(" ").slice(0,60);
}
function greetingText(role:"teacher"|"student",name?:string){const person=cleanName(name);if(role==="teacher")return person?`حياك الله يا أستاذ ${person}، نورت بوابة أستاذ لحوني.`:"حياك الله يا أستاذ، نورت بوابة أستاذ لحوني.";return person?`حياك الله يا ${person}، يوم دراسي موفق بإذن الله.`:"حياك الله، يوم دراسي موفق بإذن الله."}
function chooseArabicVoice(voices:SpeechSynthesisVoice[]){const a=voices.filter(v=>/^ar(?:-|$)/i.test(v.lang));return a.find(v=>/^ar-SA$/i.test(v.lang))||a.find(v=>/saudi|ar-sa/i.test(`${v.name} ${v.lang}`))||a.find(v=>/natural|microsoft|google/i.test(v.name))||a[0]||null}

function playLearningJingle(role:"teacher"|"student"){
  if(typeof window==="undefined")return;
  const key=`lahooni:jingle:${role}`;if(sessionStorage.getItem(key))return;
  try{
    const AudioCtx=(window.AudioContext||(window as any).webkitAudioContext) as typeof AudioContext|undefined;if(!AudioCtx)return;
    const ctx=new AudioCtx();const master=ctx.createGain();master.gain.value=.045;master.connect(ctx.destination);
    const notes=[261.63,329.63,392,523.25,392,440,523.25,659.25];
    const start=ctx.currentTime+.05;notes.forEach((freq,i)=>{const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type="sine";osc.frequency.value=freq;gain.gain.setValueAtTime(0,start+i*.23);gain.gain.linearRampToValueAtTime(1,start+i*.23+.025);gain.gain.exponentialRampToValueAtTime(.001,start+i*.23+.2);osc.connect(gain);gain.connect(master);osc.start(start+i*.23);osc.stop(start+i*.23+.22)});
    sessionStorage.setItem(key,"1");window.setTimeout(()=>void ctx.close(),2600);
  }catch{}
}

export default function PortalVoiceGreeting({role,name,identityKey}:PortalVoiceGreetingProps){
  const attemptedRef=useRef("");const startedRef=useRef(false);const text=useMemo(()=>greetingText(role,name),[role,name]);const onceKey=`lahooni:greeted:${role}`;
  const speak=useCallback(()=>{
    if(typeof window==="undefined"||sessionStorage.getItem(onceKey))return true;
    sessionStorage.setItem(onceKey,"1");
    const nativeApp=(window as unknown as {OstadhApp?:NativeSpeechBridge}).OstadhApp;
    try{if(nativeApp?.speakArabic){nativeApp.speakArabic(text);startedRef.current=true;window.setTimeout(()=>playLearningJingle(role),2600);return true}if(window.OstadhTts?.speakArabic){window.OstadhTts.speakArabic(text);startedRef.current=true;window.setTimeout(()=>playLearningJingle(role),2600);return true}}catch{}
    if(!("speechSynthesis" in window)||typeof SpeechSynthesisUtterance==="undefined"){window.setTimeout(()=>playLearningJingle(role),450);return false}
    try{const u=new SpeechSynthesisUtterance(text);u.lang="ar-SA";u.rate=.88;u.pitch=.96;u.volume=.82;const voice=chooseArabicVoice(window.speechSynthesis.getVoices());if(voice)u.voice=voice;u.onstart=()=>{startedRef.current=true};u.onend=()=>playLearningJingle(role);u.onerror=()=>window.setTimeout(()=>playLearningJingle(role),250);window.speechSynthesis.speak(u);return true}catch{window.setTimeout(()=>playLearningJingle(role),250);return false}
  },[text,role,onceKey]);
  useEffect(()=>{if(typeof window==="undefined"||!identityKey||attemptedRef.current===identityKey||sessionStorage.getItem(onceKey))return;attemptedRef.current=identityKey;startedRef.current=false;let cancelled=false;const trySpeak=()=>{if(!cancelled&&!startedRef.current)speak()};const timer=window.setTimeout(trySpeak,420);const retry=window.setTimeout(trySpeak,1200);const voices=()=>trySpeak();window.speechSynthesis?.addEventListener?.("voiceschanged",voices);return()=>{cancelled=true;window.clearTimeout(timer);window.clearTimeout(retry);window.speechSynthesis?.removeEventListener?.("voiceschanged",voices)}},[identityKey,speak,onceKey]);
  return null;
}
