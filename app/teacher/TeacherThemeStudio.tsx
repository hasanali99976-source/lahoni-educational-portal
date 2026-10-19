"use client";
import { useEffect, useState } from "react";
import "./teacher-themes.css";

export const themeOptions=[
 {id:"original",name:"الأصلي",description:"هوية لحوني المعتمدة",mark:"◈"},
 {id:"history",name:"التاريخ",description:"مخطوطات وخريطة زمنية وألوان تراثية",mark:"⌛"},
 {id:"clouds",name:"الغيوم",description:"سماوي وغيوم ناعمة",mark:"☁"},
 {id:"hilal",name:"الهلال السعودي",description:"هلال وزخارف وطنية خضراء",mark:"☾"},
 {id:"islamic",name:"الإسلامي",description:"أقواس وزخارف هندسية",mark:"✧"},
 {id:"diriyah",name:"الدرعية",description:"رمال وعمارة نجدية",mark:"▦"},
 {id:"royal",name:"الملكي",description:"كحلي وذهبي",mark:"✦"},
] as const;
export type ThemeId=(typeof themeOptions)[number]["id"];
export type ThemeDensity="comfortable"|"compact";
export const themeKey=(id:string)=>"lahooni:teacher-appearance:v1:"+id;
type ThemeSettings={theme:ThemeId;density:ThemeDensity};
const defaultSettings:ThemeSettings={theme:"original",density:"comfortable"};
function validSettings(value:unknown):ThemeSettings{
 const obj=value&&typeof value==="object"?value as Record<string,unknown>:{};
 return {theme:themeOptions.some(t=>t.id===obj.theme)?obj.theme as ThemeId:"original",density:obj.density==="compact"?"compact":"comfortable"};
}
export default function TeacherThemeStudio({teacherId}:{teacherId:string}){
 const[settings,setSettings]=useState<ThemeSettings>(defaultSettings);
 const[open,setOpen]=useState(false);
 const[loaded,setLoaded]=useState(false);
 useEffect(()=>{if(!teacherId)return;let saved=defaultSettings;try{saved=validSettings(JSON.parse(localStorage.getItem(themeKey(teacherId))||"null"))}catch{}setSettings(saved);setLoaded(true)},[teacherId]);
 useEffect(()=>{if(!loaded)return;const shell=document.querySelector(".teacher-student-shell");if(!(shell instanceof HTMLElement))return;shell.dataset.teacherTheme=settings.theme;shell.dataset.teacherDensity=settings.density;return()=>{delete shell.dataset.teacherTheme;delete shell.dataset.teacherDensity}},[settings,loaded]);
 function change(next:ThemeSettings){setSettings(next);try{localStorage.setItem(themeKey(teacherId),JSON.stringify(next))}catch{}}
 return <>
  <button type="button" className="teacher-theme-launch" onClick={()=>setOpen(true)} aria-label="تخصيص تصميم بوابة المعلم">🎨 هويتي</button>
  {open&&<div className="teacher-theme-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
   <section className="teacher-theme-panel" role="dialog" aria-modal="true" aria-labelledby="teacher-theme-title" dir="rtl">
    <header><div><span>استوديو تصاميم المعلم</span><h2 id="teacher-theme-title">هويتي 🎨</h2><p>اختر هوية كاملة لبوابتك: الخط والتبويبات والخلفيات والألوان.</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="إغلاق">✕</button></header>
    <div className="teacher-theme-options">{themeOptions.map(item=><button type="button" key={item.id} className={"teacher-theme-choice theme-preview-"+item.id+(settings.theme===item.id?" chosen":"")} onClick={()=>change({...settings,theme:item.id})} aria-pressed={settings.theme===item.id}><span className="teacher-theme-symbol">{item.mark}</span><strong>{item.name}</strong><small>{item.description}</small>{settings.theme===item.id&&<em>✓ مختار</em>}</button>)}</div>
    <div className="teacher-theme-density"><strong>طريقة عرض التبويبات</strong><div><button type="button" aria-pressed={settings.density==="comfortable"} onClick={()=>change({...settings,density:"comfortable"})}>مريح</button><button type="button" aria-pressed={settings.density==="compact"} onClick={()=>change({...settings,density:"compact"})}>مدمج</button></div></div>
    <footer><span>المعاينة مباشرة، والحفظ تلقائي على هذا الجهاز لهذا المعلم فقط.</span><button type="button" onClick={()=>change(defaultSettings)}>استعادة الأصلي</button><button type="button" className="teacher-theme-done" onClick={()=>setOpen(false)}>تم</button></footer>
   </section>
  </div>}
 </>;
}
