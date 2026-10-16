"use client";
import {useEffect,useRef,useState} from "react";
import {usePathname} from "next/navigation";
import "./creative-experience.css";
type Level="off"|"calm"|"interactive";
const KEY="lahoni-creative-v1";
function playTransition(){try{const Ctx=window.AudioContext;if(!Ctx)return;const ctx=new Ctx();const now=ctx.currentTime;const oscillator=ctx.createOscillator();const gain=ctx.createGain();oscillator.type="sine";oscillator.frequency.setValueAtTime(620,now);oscillator.frequency.exponentialRampToValueAtTime(880,now+.095);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.055,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+.15);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(now);oscillator.stop(now+.16);oscillator.onended=()=>{void ctx.close()}}catch{}}
export default function CreativeExperience({name}:{name:string}){
 const pathname=usePathname();const soundSettings=useRef({voice:false,level:"calm" as Level});const lastSoundAt=useRef(0);const previousPath=useRef(pathname);
 const [level,setLevel]=useState<Level>("calm"),[voice,setVoice]=useState(false),[open,setOpen]=useState(false),[visible,setVisible]=useState(true);
 useEffect(()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||"{}");if(["off","calm","interactive"].includes(v.level))setLevel(v.level);setVoice(v.voice===true);soundSettings.current={voice:v.voice===true,level:["off","calm","interactive"].includes(v.level)?v.level:"calm"}}catch{}},[]);
 useEffect(()=>{soundSettings.current={voice,level}},[voice,level]);
 useEffect(()=>{if(previousPath.current!==pathname){previousPath.current=pathname;if(soundSettings.current.voice&&soundSettings.current.level!=="off"&&Date.now()-lastSoundAt.current>350){lastSoundAt.current=Date.now();playTransition()}}},[pathname]);
 useEffect(()=>{const onClick=(event:MouseEvent)=>{if(!event.isTrusted||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const target=event.target;if(!(target instanceof Element))return;const anchor=target.closest("a[href]");if(!anchor||anchor.hasAttribute("download")||anchor.getAttribute("target")==="_blank")return;const url=new URL(anchor.href,window.location.href);if(url.origin!==window.location.origin||!url.pathname.startsWith("/teacher/")||url.pathname===window.location.pathname)return;const settings=soundSettings.current;if(!settings.voice||settings.level==="off"||Date.now()-lastSoundAt.current<350)return;lastSoundAt.current=Date.now();playTransition()};document.addEventListener("click",onClick,true);return()=>document.removeEventListener("click",onClick,true)},[]);
 const save=(next:Level,sound:boolean)=>{soundSettings.current={level:next,voice:sound};setLevel(next);setVoice(sound);if(sound&&next!=="off")playTransition();try{localStorage.setItem(KEY,JSON.stringify({level:next,voice:sound}))}catch{}};
 const say=(message:string)=>{if(!("speechSynthesis" in window))return;try{window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(message);speech.lang="ar-SA";speech.rate=.92;const arabic=window.speechSynthesis.getVoices().find(v=>v.lang.startsWith("ar"));if(arabic)speech.voice=arabic;window.speechSynthesis.speak(speech)}catch{}};
 const message=`أهلًا أستاذ ${name||"المعلم"}، أتمنى لك يومًا تعليميًا مميزًا. يمكنك مراجعة الحضور والمتابعة والتحصيل من تبويبات بوابتك.`;
 return <aside className={`lahoni-creative lahoni-creative--${level}`} dir="rtl" aria-label="المساعد الذكي للمعلم">
 <button className="lc-launch" onClick={()=>{setOpen(x=>!x);setVisible(true)}} aria-expanded={open} title="المساعد والإعدادات الإبداعية">🤖 <span>مساعد لحوني</span></button>
 {open&&<section className="lc-panel"><header><b>✨ المساعد الذكي للمعلم</b><button onClick={()=>setOpen(false)} aria-label="إغلاق">×</button></header>
 <p>مرحبًا أستاذ {name}. أنا مساعدك التفاعلي، أساعدك في الوصول السريع إلى أعمالك.</p>
 {visible&&level!=="off"&&<div className="lc-message">💡 راجع حضور حصصك، ثم متابعة الطلاب ودرجاتهم. تظهر المعلومات التفصيلية من سجلاتك الأصلية.</div>}
 <div className="lc-actions"><a href="/teacher/attendance">✓ الحضور</a><a href="/teacher/follow-up">📈 المتابعة</a><a href="/teacher/grades">▤ التحصيل</a></div>
 <button className="lc-speak" onClick={()=>say(message)}>🔊 استمع للترحيب {voice?"(الصوت مفعّل)":""}</button>
 <fieldset><legend>⚙️ الإعدادات الإبداعية</legend><label>مؤثرات البوابة<select value={level} onChange={e=>save(e.target.value as Level,voice)}><option value="off">إيقاف</option><option value="calm">هادئ</option><option value="interactive">تفاعلي</option></select></label><label>صوت الانتقالات <input type="checkbox" checked={voice} onChange={e=>save(level,e.target.checked)}/></label></fieldset>
 <small>المساعد يعمل محليًا دون قراءات إضافية لقاعدة البيانات. صوت الانتقالات يعمل بعد تفعيله وبالتفاعل مع التبويبات؛ الترحيب الصوتي يعمل عند الضغط على زر الاستماع.</small></section>}
 </aside>;
}
