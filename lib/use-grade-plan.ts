"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeGradePlan, type GradePlan } from "./grade-plan";
import { readLocalGradePlan, readScopedLocalGradePlan, saveLocalGradePlan, setGradePlanCurrentSubject, setGradePlanCurrentTeacher } from "./grade-plan-local";
import { useTeacherClient } from "./teacher-client";

type GradePlanState = {
  activePlan: GradePlan | null;
  loading: boolean;
  error: string;
  history: Array<{ id: string; version: number; mode: string; method: string; status: string; activatedAt: string; archivedAt?: string }>;
};
type GradePlanPayload={activePlan?:unknown;history?:GradePlanState["history"];planSource?:string;message?:string};
const PLAN_TTL=5*60*1000;
const planCache=new Map<string,{at:number,data:GradePlanPayload}>();
const planInflight=new Map<string,Promise<GradePlanPayload>>();
function cleanSubject(value: unknown) { return String(value || "").trim().split("--")[0]; }
async function readPlan(subjectId:string){const cached=planCache.get(subjectId);if(cached&&Date.now()-cached.at<PLAN_TTL)return cached.data;const pending=planInflight.get(subjectId);if(pending)return pending;const request=fetch(`/api/teacher/grade-plan?subjectId=${encodeURIComponent(subjectId)}`,{credentials:"same-origin"}).then(async response=>{const data=await response.json().catch(()=>({})) as GradePlanPayload;if(!response.ok)throw new Error(data.message||"تعذر تحميل خطة توزيع الدرجات.");planCache.set(subjectId,{at:Date.now(),data});return data}).finally(()=>planInflight.delete(subjectId));planInflight.set(subjectId,request);return request;}

export function useGradePlan(enabled = true) {
  const session = useTeacherClient();
  const teacherId = String(session.teacherId || "").trim();
  const subjectId = cleanSubject(session.subjectKey);
  const assignedSubjects = useMemo(() => { const ids=new Set<string>(); (session.subjects||[]).forEach(item=>{const id=cleanSubject(item.subjectId);if(id)ids.add(id)}); (session.assignments||[]).forEach(item=>{const id=cleanSubject(item.subjectId);if(id)ids.add(id)}); return [...ids]; }, [session.subjects, session.assignments]);
  const allowLegacyLocal = assignedSubjects.length === 1 && assignedSubjects[0] === subjectId;
  const [state,setState]=useState<GradePlanState>({activePlan:null,loading:enabled,error:"",history:[]});

  const refresh=useCallback(async()=>{
    if(!enabled){setState({activePlan:null,loading:false,error:"",history:[]});return null}
    if(!teacherId||!subjectId){setState({activePlan:null,loading:false,error:"",history:[]});return null}
    setGradePlanCurrentTeacher(teacherId);setGradePlanCurrentSubject(subjectId);const scopedLocalPlan=readScopedLocalGradePlan(teacherId,subjectId);setState(current=>({...current,loading:true,error:""}));
    try{
      const data=await readPlan(subjectId);let serverPlan=normalizeGradePlan(data.activePlan);let activePlan=serverPlan;
      const shouldSyncLocal=Boolean(scopedLocalPlan&&(!serverPlan||data.planSource==="legacy"||String(scopedLocalPlan.id||"").startsWith("local-")));
      if(shouldSyncLocal&&scopedLocalPlan){try{const syncResponse=await fetch("/api/teacher/grade-plan",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({subjectId,plan:scopedLocalPlan})});const syncData=await syncResponse.json().catch(()=>({}));if(syncResponse.ok){const syncedPlan=normalizeGradePlan(syncData.activePlan);if(syncedPlan){serverPlan=syncedPlan;activePlan=syncedPlan;saveLocalGradePlan(syncedPlan,subjectId);planCache.delete(subjectId)}}}catch{}}
      if(serverPlan)saveLocalGradePlan(serverPlan,subjectId);setState({activePlan,loading:false,error:"",history:Array.isArray(data.history)?data.history:[]});return activePlan;
    }catch(error){const fallback=readLocalGradePlan(teacherId,subjectId,allowLegacyLocal);setState({activePlan:fallback,loading:false,error:fallback?"":error instanceof Error?error.message:"تعذر تحميل خطة توزيع الدرجات.",history:[]});return fallback}
  },[enabled,teacherId,subjectId,allowLegacyLocal]);
  useEffect(()=>{void refresh()},[refresh]);
  return {...state,refresh};
}
