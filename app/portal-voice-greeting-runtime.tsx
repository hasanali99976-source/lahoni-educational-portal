"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import PortalVoiceGreeting from "../lib/portal-voice-greeting";

type GreetingIdentity = { role:"teacher"|"student"; name:string; identityKey:string };
function textOf(selector:string){return String(document.querySelector(selector)?.textContent||"").trim()}
function detectIdentity(pathname:string):GreetingIdentity|null{
  if(pathname.startsWith("/teacher")&&document.querySelector(".teacher-academy-v12")){
    const name=textOf(".academy-v12-profile-copy h2");
    return {role:"teacher",name:name&&name!=="المعلم"?name:"",identityKey:`teacher:${name||"active"}`};
  }
  if(pathname.startsWith("/student")&&document.querySelector(".student-academy-v4")&&!document.querySelector(".student-gateway-v4")){
    const name=textOf(".sta4-id strong")||textOf(".sta4-student strong");
    const code=textOf(".sta4-id code");
    return {role:"student",name:name&&name!=="الطالب"?name:"",identityKey:`student:${code||name||"active"}`};
  }
  return null;
}

export default function PortalVoiceGreetingRuntime(){
  const pathname=usePathname();
  const [identity,setIdentity]=useState<GreetingIdentity|null>(null);
  useEffect(()=>{
    let frame=0;let timeout=0;
    const update=()=>{
      window.cancelAnimationFrame(frame);
      frame=window.requestAnimationFrame(()=>{
        if(pathname==="/teacher"&&document.querySelector(".teacher-login-v14")){
          sessionStorage.removeItem("lahooni:greeted:teacher");
          sessionStorage.removeItem("lahooni:jingle:teacher");
          setIdentity(null);return;
        }
        if(pathname==="/student"&&document.querySelector(".student-gateway-v4")){
          sessionStorage.removeItem("lahooni:greeted:student");
          sessionStorage.removeItem("lahooni:jingle:student");
          setIdentity(null);return;
        }
        setIdentity(detectIdentity(pathname));
      });
    };
    update();timeout=window.setTimeout(update,700);
    const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    window.addEventListener("pageshow",update);
    return()=>{observer.disconnect();window.cancelAnimationFrame(frame);window.clearTimeout(timeout);window.removeEventListener("pageshow",update);setIdentity(null)};
  },[pathname]);
  if(!identity)return null;
  return <PortalVoiceGreeting role={identity.role} name={identity.name} identityKey={identity.identityKey} compact/>;
}
