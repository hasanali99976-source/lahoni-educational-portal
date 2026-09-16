"use client";

import { useEffect } from "react";

const TIMETABLE_PREFIX="ostadh-lahooni:timetable:";

function clearDeviceTimetableDrafts(){
  if(typeof window==="undefined"||!navigator.onLine)return;
  try{
    const keys:string[]=[];
    for(let i=0;i<window.localStorage.length;i+=1){const key=window.localStorage.key(i);if(key?.startsWith(TIMETABLE_PREFIX))keys.push(key);}
    keys.forEach(key=>window.localStorage.removeItem(key));
    if(keys.length)window.dispatchEvent(new CustomEvent("lahooni:cloud-source-restored"));
  }catch{}
}

export default function SharedSourceSync(){
  useEffect(()=>{
    clearDeviceTimetableDrafts();
    const refresh=()=>clearDeviceTimetableDrafts();
    window.addEventListener("online",refresh);
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",refresh);
    return()=>{window.removeEventListener("online",refresh);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[]);
  return null;
}
