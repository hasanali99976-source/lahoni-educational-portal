"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function StudentSubjectGateRuntime(){
  const pathname = usePathname();
  const [detail,setDetail] = useState(false);

  useEffect(()=>{
    if(pathname!=="/student") return;
    let mounted=true;
    let observer:MutationObserver|undefined;

    const apply=()=>{
      if(!mounted) return;
      const portal=document.querySelector(".student-academy-v4");
      const gateway=document.querySelector(".student-gateway-v4");
      if(!portal || gateway) return;
      document.documentElement.classList.add("student-subject-gate-active");
      if(!document.documentElement.dataset.studentSubjectEntered){
        document.documentElement.dataset.studentSubjectEntered="0";
        setDetail(false);
      }else{
        setDetail(document.documentElement.dataset.studentSubjectEntered==="1");
      }

      portal.querySelectorAll<HTMLButtonElement>(".sta4-subject").forEach(btn=>{
        if(btn.dataset.subjectGateBound==="1") return;
        btn.dataset.subjectGateBound="1";
        btn.addEventListener("click",()=>{
          document.documentElement.dataset.studentSubjectEntered="1";
          setDetail(true);
          window.scrollTo({top:0,behavior:"smooth"});
        });
      });
    };

    const timer=window.setTimeout(apply,60);
    observer=new MutationObserver(apply);
    observer.observe(document.body,{childList:true,subtree:true});
    return ()=>{
      mounted=false;
      clearTimeout(timer);
      observer?.disconnect();
      document.documentElement.classList.remove("student-subject-gate-active");
      delete document.documentElement.dataset.studentSubjectEntered;
    };
  },[pathname]);

  if(pathname!=="/student" || !detail) return null;
  return <button type="button" className="student-back-to-subjects" onClick={()=>{
    document.documentElement.dataset.studentSubjectEntered="0";
    setDetail(false);
    window.scrollTo({top:0,behavior:"smooth"});
  }}>← العودة إلى موادي</button>;
}
