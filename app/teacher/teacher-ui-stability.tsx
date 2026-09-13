"use client";

import { useLayoutEffect } from "react";

export default function TeacherUiStability(){
  useLayoutEffect(()=>{
    document.documentElement.classList.add("teacher-ui-ready");
  },[]);

  return null;
}
