"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const DAY_INDEX:Record<string,number>={sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4};
const MIN_DATE="2026-08-23";

function fmt(date:Date){
  const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,"0"); const d=String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function setReactInput(input:HTMLInputElement,value:string){
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;
  setter?.call(input,value); input.dispatchEvent(new Event("input",{bubbles:true})); input.dispatchEvent(new Event("change",{bubbles:true}));
}
function norm(value:string){return value.replace(/\s+/g," ").trim();}

export default function TeacherAttendanceScheduleNav(){
  const pathname=usePathname();
  useEffect(()=>{
    if(!pathname.startsWith("/teacher/attendance")) return;
    let stopped=false;
    let schedule=new Map<string,Set<number>>();
    async function load(){
      const shell=document.querySelector<HTMLElement>(".teacher-academy-v12");
      const subjectId=shell?.dataset.subject||"history";
      try{
        const response=await fetch(`/api/teacher/timetable?subjectId=${encodeURIComponent(subjectId)}`,{cache:"no-store",credentials:"same-origin"});
        const data=await response.json();
        const lessons=data?.lessons&&typeof data.lessons==="object"?data.lessons:{};
        const next=new Map<string,Set<number>>();
        Object.entries(lessons).forEach(([cell,raw])=>{
          const match=cell.match(/^(sunday|monday|tuesday|wednesday|thursday)-[1-7]$/); if(!match) return;
          const className=norm(String((raw as {className?:string})?.className||"")); if(!className) return;
          const set=next.get(className)||new Set<number>(); set.add(DAY_INDEX[match[1]]); next.set(className,set);
        });
        if(!stopped)schedule=next;
      }catch{schedule=new Map();}
    }
    void load();

    function nearest(className:string,current:string,direction:-1|1,fromToday=false){
      const days=schedule.get(norm(className)); if(!days?.size)return null;
      const today=new Date(); today.setHours(12,0,0,0);
      let cursor=fromToday?new Date(today):new Date(`${current}T12:00:00`);
      if(fromToday && days.has(cursor.getDay())) return fmt(cursor);
      for(let i=0;i<21;i++){
        cursor.setDate(cursor.getDate()+direction);
        const value=fmt(cursor);
        if(value<MIN_DATE)break;
        if(cursor>today)continue;
        if(days.has(cursor.getDay()))return value;
      }
      return null;
    }

    function onClick(event:MouseEvent){
      const button=(event.target as HTMLElement).closest<HTMLButtonElement>(".attendance-day-nav button"); if(!button)return;
      const classSelect=document.querySelector<HTMLSelectElement>("[data-attendance-class-select='true']");
      const dateInput=document.querySelector<HTMLInputElement>("[data-attendance-date-input='true']");
      if(!classSelect?.value||!dateInput?.value)return;
      const days=schedule.get(norm(classSelect.value)); if(!days?.size)return;
      const text=button.textContent?.trim()||"";
      let target:string|null=null;
      if(text.includes("السابق")) target=nearest(classSelect.value,dateInput.value,-1);
      else if(text.includes("التالي")) target=nearest(classSelect.value,dateInput.value,1);
      else if(text.includes("اليوم")) target=nearest(classSelect.value,dateInput.value,-1,true);
      if(!target)return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); setReactInput(dateInput,target);
    }
    document.addEventListener("click",onClick,true);
    return()=>{stopped=true;document.removeEventListener("click",onClick,true);};
  },[pathname]);
  return null;
}
