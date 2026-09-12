"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

export default function TeacherUiStability(){
  const pathname=usePathname();

  useLayoutEffect(()=>{
    const root=document.documentElement;
    root.classList.remove("teacher-ui-ready");
    let frame1=0;
    let frame2=0;
    frame1=window.requestAnimationFrame(()=>{
      frame2=window.requestAnimationFrame(()=>root.classList.add("teacher-ui-ready"));
    });
    return ()=>{
      window.cancelAnimationFrame(frame1);
      window.cancelAnimationFrame(frame2);
      root.classList.remove("teacher-ui-ready");
    };
  },[pathname]);

  return null;
}
