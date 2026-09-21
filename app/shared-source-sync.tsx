"use client";

import { useEffect } from "react";

const ROSTER_SESSION_PREFIX="lahooni-roster-session-";

function restoreSharedCloudSource(){
  if(typeof window==="undefined"||!navigator.onLine)return;
  try{
    const rosterKeys:string[]=[];
    for(let i=0;i<window.sessionStorage.length;i+=1){
      const key=window.sessionStorage.key(i);
      if(key?.startsWith(ROSTER_SESSION_PREFIX))rosterKeys.push(key);
    }
    rosterKeys.forEach(key=>window.sessionStorage.removeItem(key));

    if(rosterKeys.length){
      window.dispatchEvent(new CustomEvent("lahooni:cloud-source-restored"));
    }
  }catch{}
}

export default function SharedSourceSync(){
  useEffect(()=>{
    restoreSharedCloudSource();
    const refresh=()=>restoreSharedCloudSource();
    window.addEventListener("online",refresh);
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",refresh);
    return()=>{
      window.removeEventListener("online",refresh);
      window.removeEventListener("focus",refresh);
      document.removeEventListener("visibilitychange",refresh);
    };
  },[]);
  return null;
}
