"use client";
import {useEffect,useState} from "react";
import "./creative-experience.css";
type Level="off"|"calm"|"interactive";
const KEY="lahoni-creative-v1";
export default function CreativeExperience({name}:{name:string}){
 const [level,setLevel]=useState<Level>("calm"),[voice,setVoice]=useState(false),[open,setOpen]=useState(false),[visible,setVisible]=useState(true);
 useEffect(()=>{try{const v=JSON.parse(localStorage.getItem(KEY)||"{}");if(["off","calm","interactive"].includes(v.level))setLevel(v.level);setVoice(v.voice===true)}catch{}},[]);
 const save=(next:Level,sound:boolean)=>{setLevel(next);setVoice(sound);try{localStorage.setItem(KEY,JSON.stringify({level:next,voice:sound}))}catch{}};
 const say=(message:string)=>{if(!("speechSynthesis" in window))return;try{window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(message);speech.lang="ar-SA";speech.rate=.92;const arabic=window.speechSynthesis.getVoices().find(v=>v.lang.startsWith("ar"));if(arabic)speech.voice=arabic;window.speechSynthesis.speak(speech)}catch{}};
 const message=`أهلًا أستاذ ${name||"المعلم"}، أتمنى لك يومًا تعليميًا مميزًا. يمكنك مراجعة الحضور والمتابعة والتحصيل من تبويبات بوابتك.`;
 return <aside className={`lahoni-creative lahoni-creative--${level}`} dir="rtl" aria-label="المساعد الذكي للمعلم">
 <button className="lc-launch" onClick={()=>{setOpen(x=>!x);setVisible(true)}} aria-expanded={open} title="المساعد والإعدادات الإبداعية">🤖 <span>مساعد لحوني</span></button>
 {open&&<section className="lc-panel"><header><b>✨ المساعد الذكي للمعلم</b><button onClick={()=>setOpen(false)} aria-label="إغلاق">×</button></header>
 <p>مرحبًا أستاذ {name}. أنا مساعدك التفاعلي، أساعدك في الوصول السريع إلى أعمالك.</p>
 {visible&&level!=="off"&&<div className="lc-message">💡 راجع حضور حصصك، ثم متابعة الطلاب ودرجاتهم. تظهر المعلومات التفصيلية من سجلاتك الأصلية.</div>}
 <div className="lc-actions"><a href="/teacher/attendance">✓ الحضور</a><a href="/teacher/follow-up">📈 المتابعة</a><a href="/teacher/grades">▤ التحصيل</a></div>
 <button className="lc-speak" onClick={()=>say(message)}>🔊 استمع للترحيب {voice?"(الصوت مفعّل)":""}</button>
 <fieldset><legend>⚙️ الإعدادات الإبداعية</legend><label>مؤثرات البوابة<select value={level} onChange={e=>save(e.target.value as Level,voice)}><option value="off">إيقاف</option><option value="calm">هادئ</option><option value="interactive">تفاعلي</option></select></label><label>تفعيل الصوت <input type="checkbox" checked={voice} onChange={e=>save(level,e.target.checked)}/></label></fieldset>
 <small>المساعد يعمل محليًا دون قراءات إضافية لقاعدة البيانات. الصوت يُشغّل عند الطلب مراعاةً للحصة.</small></section>}
 </aside>;
}
