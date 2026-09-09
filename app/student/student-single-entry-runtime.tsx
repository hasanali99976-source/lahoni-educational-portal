"use client";

import { useEffect } from "react";

export default function StudentSingleEntryRuntime(){
 useEffect(()=>{
  const sync=()=>{
   const academy=document.querySelector(".student-academy-v4");
   if(!academy)return;
   document.documentElement.classList.add("student-single-entry-active");
   document.querySelectorAll<HTMLElement>(".student-subject-chooser").forEach(node=>node.remove());
   const mySubjects=[...document.querySelectorAll<HTMLButtonElement>(".student-change-subject-v300")];
   mySubjects.forEach(button=>{if((button.textContent||"").trim()==="موادي")button.style.display="none";});
  };
  sync();const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});return()=>{observer.disconnect();document.documentElement.classList.remove("student-single-entry-active")};
 },[]);
 return null;
}
