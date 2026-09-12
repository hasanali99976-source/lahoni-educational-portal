"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./teacher-activity-leaderboard-v4.css";

type Counts = Record<string, number>;
type ActivityRow = { teacherId:string; teacherName:string; active:boolean; accountCreatedAt:string; score:number; meaningfulActions:number; activeDays:number; diversity:number; counts:Counts; firstActivityAt:string; lastActivityAt:string; dataComplete:boolean; readFailureCount:number; rank:number };
type ActivityResponse = { ok?:boolean; period?:string; rows?:ActivityRow[]; rule?:string; generatedAt?:string; coverageStartAt?:string; totalTeachers?:number; activeTeachers?:number; inactiveTeachers?:number; readFailureCount?:number; integrity?:"verified"|"partial"; message?:string };
const LABELS:Array<[string,string]>=[["attendance","تحضير"],["grades","رصد"],["note","ملاحظات"],["diagnostic","اختبارات"],["remedial","خطط علاجية"],["referral","إحالات"],["timetable","جدول"],["gradePlan","خطة"]];
const ar=(value:number)=>new Intl.NumberFormat("ar-SA-u-nu-arab").format(value||0);
function topCategory(row:ActivityRow){const best=LABELS.map(([key,label])=>({label,count:Number(row.counts?.[key]||0)})).sort((a,b)=>b.count-a.count)[0];return best?.count?`${best.label} ${ar(best.count)}`:"لا يوجد نشاط بعد"}

export default function TeacherActivityLeaderboard(){
 const[rows,setRows]=useState<ActivityRow[]>([]);const[meta,setMeta]=useState<ActivityResponse>({});const[loading,setLoading]=useState(true);const[error,setError]=useState("");
 const load=useCallback(async(force=false)=>{setLoading(true);setError("");try{const response=await fetch(`/api/admin/teacher-activity${force?"?refresh=1":""}`,{cache:"no-store"});const data=await response.json().catch(()=>({})) as ActivityResponse;if(!response.ok)throw new Error(data.message||"تعذر حساب التنافس الآن");setRows(Array.isArray(data.rows)?data.rows:[]);setMeta(data)}catch(reason){setError(reason instanceof Error?reason.message:"تعذر تحميل التنافس")}finally{setLoading(false)}},[]);
 useEffect(()=>{void load(false)},[load]);
 const leader=rows[0];const leaderScore=Math.max(1,leader?.score||0);const leaderActions=Math.max(0,leader?.meaningfulActions||0);
 const challengers=useMemo(()=>rows.slice(0,10),[rows]);
 return <section className="race4 race-simple" id="competition" aria-label="سباق المعلمين">
   <div className="race-simple-toolbar"><div><small>{meta.period||"التنافس الحالي"}</small><strong>سباق المعلمين</strong><span>كل عمل موثق يدفع المعلم للأمام</span></div><button type="button" onClick={()=>void load(true)} disabled={loading}>{loading?"جارٍ التحديث…":"تحديث السباق"}</button></div>
   {error?<div className="race4-empty">{error}</div>:loading&&!rows.length?<div className="race4-empty">جارٍ تجهيز السباق…</div>:!rows.length?<div className="race4-empty">لا توجد حسابات معلمين مسجلة حاليًا.</div>:<>
     <section className="race-leader-card">
       <div className="race-leader-crown">♛</div>
       <div className="race-leader-avatar">{leader.teacherName.trim().charAt(0)||"م"}</div>
       <div className="race-leader-copy"><small>المتصدر الآن</small><h2>{leader.teacherName}</h2><p>{topCategory(leader)} • {ar(leader.activeDays)} أيام نشاط • {ar(leader.diversity)} أنواع عمل</p></div>
       <div className="race-leader-score"><strong>{ar(leaderActions)}</strong><span>عمل موثق</span></div>
     </section>

     <section className="race-lanes" aria-label="مسارات المنافسة">
       {challengers.map((row,index)=>{const progress=Math.max(5,Math.round((row.score/leaderScore)*100));const gap=Math.max(0,leaderActions-row.meaningfulActions);return <article className={`race-lane ${index===0?"leader":""}`} key={row.teacherId}>
         <div className="race-lane-rank">{ar(row.rank)}</div>
         <div className="race-lane-person"><span>{row.teacherName.trim().charAt(0)||"م"}</span><div><strong>{row.teacherName}</strong><small>{topCategory(row)}</small></div></div>
         <div className="race-lane-track"><i style={{width:`${progress}%`}}><b/></i><span className="race-runner">⚡</span></div>
         <div className="race-lane-meta"><strong>{ar(row.meaningfulActions)}</strong><small>{index===0?"متصدر":`يبعد ${ar(gap)} عمل`}</small></div>
       </article>})}
     </section>

     <div className="race-simple-note"><span>المنافسة تعتمد على النشاط الموثق داخل البوابة</span><b>{ar(meta.activeTeachers??rows.filter(row=>row.active).length)} معلم نشط</b></div>
   </>}
 </section>;
}
