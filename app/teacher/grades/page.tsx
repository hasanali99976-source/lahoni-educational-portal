"use client";

import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useTeacherClient } from "../../../lib/teacher-client";
import { type ClientTenant, tenantStudentsPath } from "../../../lib/firestore-tenant-client";
import {
  GRADE_PLAN_MODE_LABELS,
  calculateGradePlanResult,
  gradeEntryKey,
  readGradeEntry,
  roundGrade,
  type GradePlanItem,
  type GradeStudentLike,
  type GradeValueMap,
} from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import "./grades-v11.css";
import "./grades-inline-deductions.css";

type GradeDeduction={
  id:string;planId?:string;scope?:"plan"|"section"|"item";
  sectionId?:string;sectionLabel?:string;itemId?:string;itemLabel?:string;
  amount?:number;reason?:string;note?:string;reversedAt?:string;
};
type Student=GradeStudentLike&{
  id:string;code:string;name:string;class:string;className:string;
  gradeValues?:GradeValueMap;gradePlanValues?:Record<string,GradeValueMap>;gradeDeductions?:GradeDeduction[];
};
type LocalValues=Record<string,GradeValueMap>;
type DeductionDraft={amount:number;reason:string;note:string};
type LocalDeductions=Record<string,DeductionDraft>;

const DEDUCTION_REASONS=[
  "عدم تسليم المهمة",
  "تأخر في التسليم",
  "نقص في متطلبات المهمة",
  "عدم إكمال النشاط",
  "ضعف المشاركة في التقييم",
  "مخالفة تعليمات التقييم",
  "سبب آخر",
] as const;
const QUICK_DEDUCTIONS=[0.5,1,2] as const;

function clamp(value:number,maximum:number){const number=Number.isFinite(value)?value:0;return roundGrade(Math.max(0,Math.min(maximum,number)));}
function uniqueReasons(items:GradeDeduction[]){return [...new Set(items.map(item=>String(item.reason||"").trim()).filter(Boolean))].join("، ");}
function uniqueNotes(items:GradeDeduction[]){return [...new Set(items.map(item=>String(item.note||"").trim()).filter(Boolean))].join("، ");}
function draftFromDeductions(items:GradeDeduction[]):DeductionDraft{
  const amount=roundGrade(items.reduce((sum,item)=>sum+Number(item.amount||0),0));
  const reasons=[...new Set(items.map(item=>String(item.reason||"").trim()).filter(Boolean))];
  const directReason=reasons.length===1&&DEDUCTION_REASONS.includes(reasons[0] as typeof DEDUCTION_REASONS[number])?reasons[0]:"";
  const reason=amount>0?(directReason||"سبب آخر"):"";
  const note=uniqueNotes(items)||(amount>0&&!directReason?uniqueReasons(items):"");
  return{amount,reason,note};
}

export default function GradesPage(){
  const session=useTeacherClient();
  const {activePlan,loading:planLoading,error:planError}=useGradePlan(true);
  const tenant=useMemo<ClientTenant|null>(()=>session.teacherId&&session.subjectKey?{teacherId:session.teacherId,teacherName:session.teacherName||"",subjectKey:session.subjectKey as never}:null,[session.teacherId,session.teacherName,session.subjectKey]);
  const [students,setStudents]=useState<Student[]>([]);
  const [selectedClass,setSelectedClass]=useState("");
  const [selectedSection,setSelectedSection]=useState("");
  const [localValues,setLocalValues]=useState<LocalValues>({});
  const [localDeductions,setLocalDeductions]=useState<LocalDeductions>({});
  const [deductionDirty,setDeductionDirty]=useState<Record<string,boolean>>({});
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [dirty,setDirty]=useState(false);

  useEffect(()=>{
    if(!tenant)return;
    const controller=new AbortController();
    const params=new URLSearchParams({subjectId:tenant.subjectKey});
    if(session.activeGrade)params.set("grade",String(session.activeGrade));
    setLoading(true);setMessage("");
    Promise.all([
      fetch(`/api/teacher/students?${params.toString()}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل الطلاب");return data;}),
      fetch(`/api/teacher/grade-data?subjectId=${encodeURIComponent(tenant.subjectKey)}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل التحصيل المحفوظ");return data;}),
    ])
      .then(([data,academicData])=>{
        const byCode=academicData.byCode&&typeof academicData.byCode==="object"?academicData.byCode as Record<string,Record<string,unknown>>:{};
        const list:Student[]=(Array.isArray(data.students)?data.students:[]).map((value:Record<string,unknown>)=>{
          const code=String(value.code||value.id||"").trim().toUpperCase();
          const className=String(value.className||value.class||"").trim();
          const academic=byCode[code]||{};
          const gradeValues=academic.gradeValues&&typeof academic.gradeValues==="object"?academic.gradeValues as GradeValueMap:value.gradeValues&&typeof value.gradeValues==="object"?value.gradeValues as GradeValueMap:{};
          const gradePlanValues=academic.gradePlanValues&&typeof academic.gradePlanValues==="object"?academic.gradePlanValues as Record<string,GradeValueMap>:value.gradePlanValues&&typeof value.gradePlanValues==="object"?value.gradePlanValues as Record<string,GradeValueMap>:{};
          const gradeDeductions=Array.isArray(academic.gradeDeductions)?academic.gradeDeductions as GradeDeduction[]:Array.isArray(value.gradeDeductions)?value.gradeDeductions as GradeDeduction[]:[];
          return{...(value as unknown as Student),id:code,code,name:String(value.name||"").trim(),class:className,className,gradeValues,gradePlanValues,gradeDeductions};
        }).filter((student:Student)=>Boolean(student.id&&student.name&&student.class));
        list.sort((a,b)=>a.class.localeCompare(b.class,"ar",{numeric:true})||a.name.localeCompare(b.name,"ar"));
        setStudents(list);
      })
      .catch(error=>{if((error as Error)?.name!=="AbortError")setMessage(error instanceof Error?error.message:"تعذر تحميل طلاب المادة الحالية");})
      .finally(()=>setLoading(false));
    return()=>controller.abort();
  },[tenant,session.activeGrade]);

  const classes=useMemo(()=>[...new Set(students.map(student=>student.class))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
  const classStudents=useMemo(()=>students.filter(student=>student.class===selectedClass),[students,selectedClass]);
  const visibleStudents=useMemo(()=>{const q=search.trim().toLocaleLowerCase("ar");return classStudents.filter(student=>!q||student.name.toLocaleLowerCase("ar").includes(q)||student.code.toLowerCase().includes(q));},[classStudents,search]);
  const section=useMemo(()=>activePlan?.sections.find(item=>item.id===selectedSection)||activePlan?.sections[0]||null,[activePlan,selectedSection]);
  const planMaximum=useMemo(()=>activePlan?.sections.reduce((sum,item)=>sum+Number(item.max||0),0)||100,[activePlan]);

  useEffect(()=>{if(!classes.length){setSelectedClass("");return;}if(!selectedClass||!classes.includes(selectedClass))setSelectedClass(classes[0]);},[classes,selectedClass]);
  useEffect(()=>{if(!activePlan?.sections.length){setSelectedSection("");return;}if(!selectedSection||!activePlan.sections.some(item=>item.id===selectedSection))setSelectedSection(activePlan.sections[0].id);},[activePlan,selectedSection]);
  useEffect(()=>{
    if(!section){setLocalValues({});return;}
    const next:LocalValues={};
    classStudents.forEach(student=>{const row:GradeValueMap={};section.items.forEach(item=>{const entry=readGradeEntry(studentForPlan(student),section,item);row[entry.key]=clamp(entry.value,item.max);});next[student.id]=row;});
    setLocalValues(next);setDirty(false);
  },[classStudents,section?.id,activePlan?.id]);
  useEffect(()=>{
    if(!activePlan||!section){setLocalDeductions({});setDeductionDirty({});return;}
    const next:LocalDeductions={};
    classStudents.forEach(student=>{next[student.id]=draftFromDeductions(sectionDeductions(student));});
    setLocalDeductions(next);setDeductionDirty({});
  },[classStudents,activePlan?.id,section?.id]);

  function itemKey(item:GradePlanItem){return section?gradeEntryKey(section.id,item.id):"";}
  function valuesForPlan(student:Student){if(!activePlan)return student.gradeValues||{};return student.gradePlanValues?.[activePlan.id]||student.gradeValues||{};}
  function studentForPlan(student:Student){return{...student,gradeValues:valuesForPlan(student)};}
  function effectiveStudent(student:Student){return{...student,gradeValues:{...valuesForPlan(student),...(localValues[student.id]||{})}};}
  function activePlanDeductions(student:Student){if(!activePlan)return[];return(Array.isArray(student.gradeDeductions)?student.gradeDeductions:[]).filter(item=>!item.reversedAt&&(!item.planId||item.planId===activePlan.id));}
  function sectionDeductions(student:Student){if(!section)return[];return activePlanDeductions(student).filter(item=>(item.scope||"plan")==="section"&&String(item.sectionId||"")===section.id);}
  function currentSectionItemDeductions(student:Student){if(!section)return[];return activePlanDeductions(student).filter(item=>item.scope==="item"&&String(item.sectionId||"")===section.id);}
  function deductionFor(student:Student){const draft=localDeductions[student.id];if(draft)return draft;return draftFromDeductions(sectionDeductions(student));}
  function totalDeductionFor(student:Student){
    const persisted=activePlanDeductions(student);
    const other=persisted.filter(item=>!section||!((item.scope||"plan")==="section"&&String(item.sectionId||"")===section.id));
    return roundGrade(other.reduce((sum,item)=>sum+Number(item.amount||0),0)+deductionFor(student).amount);
  }
  function adjustedResult(student:Student){const result=calculateGradePlanResult(activePlan!,effectiveStudent(student));const deduction=totalDeductionFor(student);const earned=Math.max(0,roundGrade(result.earned-deduction));const availableMaximum=Math.max(0,roundGrade(result.maximum-deduction));const percentage=availableMaximum?Math.round((earned/availableMaximum)*100):0;return{result,earned,percentage,deduction,availableMaximum};}
  function setGradeValue(studentId:string,item:GradePlanItem,value:number){const key=itemKey(item);setLocalValues(current=>({...current,[studentId]:{...(current[studentId]||{}),[key]:clamp(value,item.max)}}));setDirty(true);}
  function setDeductionAmount(studentId:string,value:number){setLocalDeductions(current=>({...current,[studentId]:{...(current[studentId]||{reason:"",note:""}),amount:clamp(value,section?.max||planMaximum)}}));setDeductionDirty(current=>({...current,[studentId]:true}));}
  function setDeductionReason(studentId:string,value:string){setLocalDeductions(current=>({...current,[studentId]:{...(current[studentId]||{amount:0,note:""}),reason:value}}));setDeductionDirty(current=>({...current,[studentId]:true}));}
  function setDeductionNote(studentId:string,value:string){setLocalDeductions(current=>({...current,[studentId]:{...(current[studentId]||{amount:0,reason:""}),note:value.slice(0,500)}}));setDeductionDirty(current=>({...current,[studentId]:true}));}
  function applyFullGrade(item:GradePlanItem){const key=itemKey(item);setLocalValues(current=>{const next={...current};classStudents.forEach(student=>{next[student.id]={...(next[student.id]||{}),[key]:item.max};});return next;});setDirty(true);}
  function clearRow(studentId:string){if(!section)return;setLocalValues(current=>{const row={...(current[studentId]||{})};section.items.forEach(item=>{row[itemKey(item)]=0;});return{...current,[studentId]:row};});setDirty(true);}
  function sectionTotal(student:Student){if(!activePlan||!section)return 0;const raw=calculateGradePlanResult(activePlan,effectiveStudent(student)).sections.find(item=>item.id===section.id)?.earned||0;const itemDeduction=currentSectionItemDeductions(student).reduce((sum,item)=>sum+Number(item.amount||0),0);return Math.max(0,roundGrade(raw-itemDeduction-deductionFor(student).amount));}
  function handleCellKey(event:KeyboardEvent<HTMLInputElement>,studentIndex:number,itemIndex:number){if(event.key!=="Enter")return;event.preventDefault();const next=document.querySelector<HTMLInputElement>(`[data-grade-cell="${studentIndex+1}-${itemIndex}"]`)||document.querySelector<HTMLInputElement>(`[data-grade-cell="0-${itemIndex+1}"]`);next?.focus();next?.select();}

  const hasDeductionChanges=Object.values(deductionDirty).some(Boolean);
  const hasChanges=dirty||hasDeductionChanges;

  const classAnalytics=useMemo(()=>{
    if(!activePlan)return{average:0,complete:0,support:0,excellent:0,completion:0};
    const results=classStudents.map(student=>adjustedResult(student));
    const recorded=results.filter(item=>item.result.recordedMaximum>0);
    return{
      average:recorded.length?Math.round(recorded.reduce((sum,item)=>sum+item.percentage,0)/recorded.length):0,
      complete:results.filter(item=>item.result.complete).length,
      support:recorded.filter(item=>item.percentage<60).length,
      excellent:recorded.filter(item=>item.percentage>=90).length,
      completion:results.length?Math.round(results.reduce((sum,item)=>sum+item.result.completion,0)/results.length):0,
    };
  },[activePlan,classStudents,localValues,localDeductions,section?.id]);

  const sectionAnalytics=useMemo(()=>{
    if(!activePlan||!section||!classStudents.length)return{average:0,recorded:0};
    const values=classStudents.map(student=>sectionTotal(student));
    const recorded=values.filter(value=>value>0);
    return{average:recorded.length?Math.round((recorded.reduce((sum,value)=>sum+value,0)/recorded.length)*10)/10:0,recorded:recorded.length};
  },[activePlan,section,classStudents,localValues,localDeductions]);

  const aiInsight=classAnalytics.support
    ? `${classAnalytics.support} طالب في الفصل تحت 60٪ بعد احتساب الخصومات. بعد الحفظ انتقل للإتقان والمهارة لتحديد التدخل المناسب.`
    : classAnalytics.completion<100
      ? `اكتمال الرصد للفصل ${classAnalytics.completion}٪. ركز على الخانات الناقصة قبل الحكم على مستوى الطالب.`
      : "الرصد مكتمل. خصم كل وحدة يبقى مرتبطًا بها ويظهر في سجل الطالب داخل نفس الوحدة.";

  async function saveRegister(){
    if(!tenant||!selectedClass||!activePlan||!section)return setMessage("اختر الفصل والوحدة أولًا");
    const missingReason=classStudents.find(student=>deductionDirty[student.id]&&deductionFor(student).amount>0&&!deductionFor(student).reason.trim());
    if(missingReason)return setMessage(`اختر سبب الخصم للطالب ${missingReason.name}.`);
    const missingNote=classStudents.find(student=>deductionDirty[student.id]&&deductionFor(student).amount>0&&deductionFor(student).reason==="سبب آخر"&&!deductionFor(student).note.trim());
    if(missingNote)return setMessage(`اكتب ملاحظة توضح سبب الخصم للطالب ${missingNote.name}.`);
    setSaving(true);
    try{
      const now=new Date().toISOString();
      await Promise.all(classStudents.map(student=>{
        const mergedValues={...valuesForPlan(student),...(localValues[student.id]||{})};
        return setDoc(doc(db,tenantStudentsPath(tenant),student.id),{
          name:student.name,class:student.class,className:student.class,code:student.code,active:true,rosterActive:true,
          gradeValues:mergedValues,gradePlanValues:{...(student.gradePlanValues||{}),[activePlan.id]:mergedValues},activeGradePlanId:activePlan.id,activeGradePlanVersion:activePlan.version,
          gradePlanUpdatedAt:now,teacherId:tenant.teacherId,subjectKey:tenant.subjectKey,
        },{merge:true});
      }));

      const changedIds=classStudents.filter(student=>deductionDirty[student.id]).map(student=>student.id);
      const deductionRows=await Promise.all(changedIds.map(async studentId=>{
        const student=classStudents.find(item=>item.id===studentId)!;
        const draft=deductionFor(student);
        const response=await fetch("/api/teacher/grade-deductions",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({subjectId:tenant.subjectKey,studentCode:student.code,planId:activePlan.id,scope:"section",sectionId:section.id,sectionLabel:section.label,amount:draft.amount,reason:draft.reason.trim(),note:draft.note.trim()}),cache:"no-store"});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.message||`تعذر حفظ خصم ${student.name}`);
        return[studentId,Array.isArray(data.deductions)?data.deductions as GradeDeduction[]:[]] as const;
      }));
      const deductionMap=new Map(deductionRows);

      setStudents(current=>current.map(student=>classStudents.some(item=>item.id===student.id)?{...student,gradeValues:{...valuesForPlan(student),...(localValues[student.id]||{})},gradePlanValues:{...(student.gradePlanValues||{}),[activePlan.id]:{...valuesForPlan(student),...(localValues[student.id]||{})}},gradeDeductions:deductionMap.get(student.id)||student.gradeDeductions}:student));
      setDirty(false);setDeductionDirty({});setMessage(`تم حفظ ${section.label} وخصوماتها لفصل ${selectedClass}.`);
    }catch(error){console.error("gradebook-save-v11",error);setMessage(error instanceof Error?error.message:"تعذر حفظ الدرجات الآن.");}finally{setSaving(false);}
  }

  if(planLoading)return <main className="grades-v11"><section className="gv11-state">جارٍ تحميل الخطة الدراسية…</section></main>;
  if(!activePlan)return <main className="grades-v11"><section className="gv11-no-plan"><small>التحصيل العلمي</small><h2>لا توجد خطة درجات معتمدة</h2><p>اعتمد هيكلة الدرجات أولًا. لن يتم حذف أو تغيير أي درجات سابقة.</p>{planError?<span>{planError}</span>:null}<Link href="/teacher/grade-plan">فتح الخطة الدراسية</Link></section></main>;

  return <main className="grades-v11" dir="rtl">
    {message?<p className="gv11-message">{message}</p>:null}

    <section className="gv11-controlbar">
      <div className="gv11-class-control"><label><span>الفصل الحالي</span><select value={selectedClass} onChange={event=>{setSelectedClass(event.target.value);setSearch("");}}>{classes.map(name=><option key={name}>{name}</option>)}</select></label><label><span>بحث سريع</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="اسم الطالب أو الكود"/></label></div>
      <div className="gv11-main-actions"><Link href="/teacher/reports">إنشاء تقرير</Link><button type="button" className={hasChanges?"dirty":""} onClick={()=>void saveRegister()} disabled={!selectedClass||saving}>{saving?"جارٍ الحفظ…":hasChanges?"حفظ التغييرات":"الرصد محفوظ"}</button></div>
    </section>

    <section className="gv11-planbar">
      <header><div><small>الخطة المعتمدة</small><h2>{GRADE_PLAN_MODE_LABELS[activePlan.mode]} • نسخة {activePlan.version}</h2></div><span>اختر {activePlan.mode==="units"?"الوحدة":"الفترة"} ثم ابدأ الرصد</span></header>
      <div className="gv11-section-tabs">{activePlan.sections.map(item=>{
        const active=item.id===section?.id;
        return <button type="button" key={item.id} className={active?"active":""} onClick={()=>setSelectedSection(item.id)}><span>{active?"تعمل الآن":"فتح"}</span><b>{item.label}</b><small>{item.max} درجة • {item.items.length} عناصر</small></button>;
      })}</div>
    </section>

    <section className="gv11-kpis">
      <article><small>طلاب الفصل</small><b>{classStudents.length}</b><span>{selectedClass||"—"}</span></article>
      <article><small>متوسط {section?.label||"الوحدة"}</small><b>{sectionAnalytics.average||"—"}</b><span>{section?.max?`من ${section.max}`:"—"}</span></article>
      <article><small>متوسط التحصيل</small><b>{classAnalytics.average?`${classAnalytics.average}٪`:"—"}</b><span>بعد احتساب الخصم</span></article>
      <article><small>اكتمال الرصد</small><b>{classAnalytics.completion}٪</b><span>{classAnalytics.complete} طالب مكتمل</span></article>
      <article><small>يحتاجون دعمًا</small><b>{classAnalytics.support}</b><span>{classAnalytics.excellent} متميز</span></article>
    </section>

    <section className="gv11-insight"><span>AI</span><div><small>قراءة أكاديمية</small><h3>{selectedClass||"اختر الفصل"} • {section?.label||""}</h3><p>{aiInsight}</p></div><Link href="/teacher/follow-up">الإتقان والمهارة</Link></section>

    <section className="gv11-gradebook">
      <header><div><small>سجل الرصد</small><h2>{section?.label}</h2><p>{section?.items.length||0} عناصر تقييم • الخصم يرتبط بهذه {activePlan.mode==="units"?"الوحدة":"الفترة"} ويظهر للطالب داخلها</p></div><div><span className={hasChanges?"pending":"saved"}>{hasChanges?"تغييرات غير محفوظة":"محفوظ"}</span><small>{visibleStudents.length} طالب ظاهر</small></div></header>
      <div className="gv11-table-wrap"><table><thead><tr><th className="num">م</th><th className="name">اسم الطالب</th>{section?.items.map(item=><th key={item.id}><span>{item.label}</span><small>من {item.max}</small><button type="button" onClick={()=>applyFullGrade(item)}>كامل للكل</button></th>)}<th>مجموع {section?.label}<small>بعد خصم الوحدة</small></th><th>قبل الخصم<small>إجمالي المادة</small></th><th className="deduction-col">خصم {section?.label}<small>درجة</small></th><th className="reason-col">سبب الخصم والملاحظة<small>تظهر للطالب داخل الوحدة</small></th><th className="final-col">المجموع النهائي<small>بعد كل الخصومات</small></th><th className="row-action">إجراء</th></tr></thead><tbody>{visibleStudents.map((student,studentIndex)=>{
        const source=effectiveStudent(student);const result=calculateGradePlanResult(activePlan,source);const deduction=deductionFor(student);const adjusted=adjustedResult(student);
        return <tr key={student.id}><td className="num">{studentIndex+1}</td><td className="name"><b>{student.name}</b><small>{student.code} • {result.completion}٪ رصد{deduction.amount>0?` • خصم ${section?.label} ${deduction.amount}`:""}</small></td>{section?.items.map((item,itemIndex)=>{const key=itemKey(item);const value=localValues[student.id]?.[key]??readGradeEntry(student,section,item).value;return <td key={item.id}><input data-grade-cell={`${studentIndex}-${itemIndex}`} type="number" min="0" max={item.max} step="0.5" value={value} onFocus={event=>event.currentTarget.select()} onKeyDown={event=>handleCellKey(event,studentIndex,itemIndex)} onChange={event=>setGradeValue(student.id,item,Number(event.target.value))}/></td>;})}<td className="section-total">{sectionTotal(student)}</td><td className="overall"><b>{result.earned}</b><small>{result.percentage}٪</small></td><td className="deduction-cell"><div className="deduction-quick">{QUICK_DEDUCTIONS.map(value=><button type="button" key={value} className={deduction.amount===value?"active":""} onClick={()=>setDeductionAmount(student.id,value)}>{value}</button>)}</div><input aria-label={`خصم ${section?.label} للطالب ${student.name}`} type="number" min="0" max={section?.max||planMaximum} step="0.5" value={deduction.amount||""} onFocus={event=>event.currentTarget.select()} onChange={event=>setDeductionAmount(student.id,Number(event.target.value))}/></td><td className="reason-cell"><select className={deduction.amount>0&&!deduction.reason.trim()?"missing-reason":""} aria-label={`سبب خصم ${student.name}`} value={deduction.reason} onChange={event=>setDeductionReason(student.id,event.target.value)}><option value="">{deduction.amount>0?"اختر السبب":"—"}</option>{DEDUCTION_REASONS.map(reason=><option key={reason} value={reason}>{reason}</option>)}</select><input className={deduction.amount>0&&deduction.reason==="سبب آخر"&&!deduction.note.trim()?"missing-note":""} aria-label={`ملاحظة خصم ${student.name}`} type="text" value={deduction.note} placeholder={deduction.amount>0?"ملاحظة المعلم":""} onChange={event=>setDeductionNote(student.id,event.target.value)}/></td><td className={`final-total ${adjusted.deduction>0?"deducted":""}`}><b>{adjusted.earned} / {adjusted.availableMaximum}</b><small>{adjusted.percentage}٪{adjusted.deduction>0?` • إجمالي الخصم ${adjusted.deduction}`:""}</small></td><td className="row-action"><button type="button" onClick={()=>clearRow(student.id)}>مسح الوحدة</button></td></tr>;
      })}{!visibleStudents.length?<tr><td className="empty" colSpan={(section?.items.length||0)+8}>{loading?"جارٍ تحميل الطلاب…":"لا توجد أسماء مطابقة."}</td></tr>:null}</tbody></table></div>
      <footer><span>خصم كل وحدة مستقل عنها؛ يظهر داخل نفس الوحدة في سجل الطالب ثم ينعكس تلقائيًا على إجمالي المادة.</span><span>{session.subject||"المادة"} • {selectedClass||"—"}</span></footer>
    </section>
  </main>;
}