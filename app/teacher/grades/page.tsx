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

type Student=GradeStudentLike&{
  id:string;code:string;name:string;class:string;className:string;
  gradeValues?:GradeValueMap;gradePlanValues?:Record<string,GradeValueMap>;
};
type LocalValues=Record<string,GradeValueMap>;
function clamp(value:number,maximum:number){const number=Number.isFinite(value)?value:0;return roundGrade(Math.max(0,Math.min(maximum,number)));}

export default function GradesPage(){
  const session=useTeacherClient();
  const {activePlan,loading:planLoading,error:planError}=useGradePlan(true);
  const tenant=useMemo<ClientTenant|null>(()=>session.teacherId&&session.subjectKey?{teacherId:session.teacherId,teacherName:session.teacherName||"",subjectKey:session.subjectKey as never}:null,[session.teacherId,session.teacherName,session.subjectKey]);
  const [students,setStudents]=useState<Student[]>([]);
  const [selectedClass,setSelectedClass]=useState("");
  const [selectedSection,setSelectedSection]=useState("");
  const [localValues,setLocalValues]=useState<LocalValues>({});
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
    fetch(`/api/teacher/students?${params.toString()}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل الطلاب");return data;})
      .then(data=>{
        const list:Student[]=(Array.isArray(data.students)?data.students:[]).map((value:Record<string,unknown>)=>{
          const code=String(value.code||value.id||"").trim().toUpperCase();
          const className=String(value.className||value.class||"").trim();
          return{...(value as unknown as Student),id:code,code,name:String(value.name||"").trim(),class:className,className,gradeValues:value.gradeValues&&typeof value.gradeValues==="object"?value.gradeValues as GradeValueMap:{}};
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

  useEffect(()=>{if(!classes.length){setSelectedClass("");return;}if(!selectedClass||!classes.includes(selectedClass))setSelectedClass(classes[0]);},[classes,selectedClass]);
  useEffect(()=>{if(!activePlan?.sections.length){setSelectedSection("");return;}if(!selectedSection||!activePlan.sections.some(item=>item.id===selectedSection))setSelectedSection(activePlan.sections[0].id);},[activePlan,selectedSection]);
  useEffect(()=>{
    if(!section){setLocalValues({});return;}
    const next:LocalValues={};
    classStudents.forEach(student=>{const row:GradeValueMap={};section.items.forEach(item=>{const entry=readGradeEntry(studentForPlan(student),section,item);row[entry.key]=clamp(entry.value,item.max);});next[student.id]=row;});
    setLocalValues(next);setDirty(false);
  },[classStudents,section?.id,activePlan?.id]);

  function itemKey(item:GradePlanItem){return section?gradeEntryKey(section.id,item.id):"";}
  function valuesForPlan(student:Student){if(!activePlan)return student.gradeValues||{};return student.gradePlanValues?.[activePlan.id]||student.gradeValues||{};}
  function studentForPlan(student:Student){return{...student,gradeValues:valuesForPlan(student)};}
  function effectiveStudent(student:Student){return{...student,gradeValues:{...valuesForPlan(student),...(localValues[student.id]||{})}};}
  function setGradeValue(studentId:string,item:GradePlanItem,value:number){const key=itemKey(item);setLocalValues(current=>({...current,[studentId]:{...(current[studentId]||{}),[key]:clamp(value,item.max)}}));setDirty(true);}
  function applyFullGrade(item:GradePlanItem){const key=itemKey(item);setLocalValues(current=>{const next={...current};classStudents.forEach(student=>{next[student.id]={...(next[student.id]||{}),[key]:item.max};});return next;});setDirty(true);}
  function clearRow(studentId:string){if(!section)return;setLocalValues(current=>{const row={...(current[studentId]||{})};section.items.forEach(item=>{row[itemKey(item)]=0;});return{...current,[studentId]:row};});setDirty(true);}
  function sectionTotal(student:Student){if(!activePlan||!section)return 0;return calculateGradePlanResult(activePlan,effectiveStudent(student)).sections.find(item=>item.id===section.id)?.earned||0;}
  function handleCellKey(event:KeyboardEvent<HTMLInputElement>,studentIndex:number,itemIndex:number){if(event.key!=="Enter")return;event.preventDefault();const next=document.querySelector<HTMLInputElement>(`[data-grade-cell="${studentIndex+1}-${itemIndex}"]`)||document.querySelector<HTMLInputElement>(`[data-grade-cell="0-${itemIndex+1}"]`);next?.focus();next?.select();}

  const classAnalytics=useMemo(()=>{
    if(!activePlan)return{average:0,complete:0,support:0,excellent:0,completion:0};
    const results=classStudents.map(student=>calculateGradePlanResult(activePlan,effectiveStudent(student)));
    const recorded=results.filter(result=>result.recordedMaximum>0);
    return{
      average:recorded.length?Math.round(recorded.reduce((sum,result)=>sum+result.percentage,0)/recorded.length):0,
      complete:results.filter(result=>result.complete).length,
      support:recorded.filter(result=>result.percentage<60).length,
      excellent:recorded.filter(result=>result.percentage>=90).length,
      completion:results.length?Math.round(results.reduce((sum,result)=>sum+result.completion,0)/results.length):0,
    };
  },[activePlan,classStudents,localValues]);

  const sectionAnalytics=useMemo(()=>{
    if(!activePlan||!section||!classStudents.length)return{average:0,recorded:0};
    const values=classStudents.map(student=>calculateGradePlanResult(activePlan,effectiveStudent(student)).sections.find(item=>item.id===section.id)?.earned||0);
    const recorded=values.filter(value=>value>0);
    return{average:recorded.length?Math.round((recorded.reduce((sum,value)=>sum+value,0)/recorded.length)*10)/10:0,recorded:recorded.length};
  },[activePlan,section,classStudents,localValues]);

  const aiInsight=classAnalytics.support
    ? `${classAnalytics.support} طالب في الفصل تحت 60٪. بعد الحفظ انتقل للإتقان والمهارة لتحديد التدخل المناسب.`
    : classAnalytics.completion<100
      ? `اكتمال الرصد للفصل ${classAnalytics.completion}٪. ركز على الخانات الناقصة قبل الحكم على مستوى الطالب.`
      : "الرصد مكتمل. يمكنك الآن مقارنة الفصول أو الانتقال للإتقان والمهارة.";

  async function saveRegister(){
    if(!tenant||!selectedClass||!activePlan||!section)return setMessage("اختر الفصل والوحدة أولًا");
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
      setStudents(current=>current.map(student=>classStudents.some(item=>item.id===student.id)?{...student,gradeValues:{...valuesForPlan(student),...(localValues[student.id]||{})},gradePlanValues:{...(student.gradePlanValues||{}),[activePlan.id]:{...valuesForPlan(student),...(localValues[student.id]||{})}}}:student));
      setDirty(false);setMessage(`تم حفظ ${section.label} لفصل ${selectedClass}.`);
    }catch(error){console.error("gradebook-save-v11",error);setMessage("تعذر حفظ الدرجات الآن.");}finally{setSaving(false);}
  }

  if(planLoading)return <main className="grades-v11"><section className="gv11-state">جارٍ تحميل الخطة الدراسية…</section></main>;
  if(!activePlan)return <main className="grades-v11"><section className="gv11-no-plan"><small>التحصيل العلمي</small><h2>لا توجد خطة درجات معتمدة</h2><p>اعتمد هيكلة الدرجات أولًا. لن يتم حذف أو تغيير أي درجات سابقة.</p>{planError?<span>{planError}</span>:null}<Link href="/teacher/grade-plan">فتح الخطة الدراسية</Link></section></main>;

  return <main className="grades-v11" dir="rtl">
    {message?<p className="gv11-message">{message}</p>:null}

    <section className="gv11-controlbar">
      <div className="gv11-class-control"><label><span>الفصل الحالي</span><select value={selectedClass} onChange={event=>{setSelectedClass(event.target.value);setSearch("");}}>{classes.map(name=><option key={name}>{name}</option>)}</select></label><label><span>بحث سريع</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="اسم الطالب أو الكود"/></label></div>
      <div className="gv11-main-actions"><Link href="/teacher/reports">إنشاء تقرير</Link><button type="button" className={dirty?"dirty":""} onClick={()=>void saveRegister()} disabled={!selectedClass||saving}>{saving?"جارٍ الحفظ…":dirty?"حفظ التغييرات":"الرصد محفوظ"}</button></div>
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
      <article><small>متوسط التحصيل</small><b>{classAnalytics.average?`${classAnalytics.average}٪`:"—"}</b><span>حسب الرصد الحالي</span></article>
      <article><small>اكتمال الرصد</small><b>{classAnalytics.completion}٪</b><span>{classAnalytics.complete} طالب مكتمل</span></article>
      <article><small>يحتاجون دعمًا</small><b>{classAnalytics.support}</b><span>{classAnalytics.excellent} متميز</span></article>
    </section>

    <section className="gv11-insight"><span>AI</span><div><small>قراءة أكاديمية</small><h3>{selectedClass||"اختر الفصل"} • {section?.label||""}</h3><p>{aiInsight}</p></div><Link href="/teacher/follow-up">الإتقان والمهارة</Link></section>

    <section className="gv11-gradebook">
      <header><div><small>سجل الرصد</small><h2>{section?.label}</h2><p>{section?.items.length||0} عناصر تقييم • مجموع {section?.max||0} درجة</p></div><div><span className={dirty?"pending":"saved"}>{dirty?"تغييرات غير محفوظة":"محفوظ"}</span><small>{visibleStudents.length} طالب ظاهر</small></div></header>
      <div className="gv11-table-wrap"><table><thead><tr><th className="num">م</th><th className="name">اسم الطالب</th>{section?.items.map(item=><th key={item.id}><span>{item.label}</span><small>من {item.max}</small><button type="button" onClick={()=>applyFullGrade(item)}>كامل للكل</button></th>)}<th>مجموع {section?.label}<small>من {section?.max}</small></th><th>التحصيل الحالي<small>من 100</small></th><th className="row-action">إجراء</th></tr></thead><tbody>{visibleStudents.map((student,studentIndex)=>{
        const source=effectiveStudent(student);const result=calculateGradePlanResult(activePlan,source);
        return <tr key={student.id}><td className="num">{studentIndex+1}</td><td className="name"><b>{student.name}</b><small>{student.code} • {result.completion}٪ رصد</small></td>{section?.items.map((item,itemIndex)=>{const key=itemKey(item);const value=localValues[student.id]?.[key]??readGradeEntry(student,section,item).value;return <td key={item.id}><input data-grade-cell={`${studentIndex}-${itemIndex}`} type="number" min="0" max={item.max} step="0.5" value={value} onFocus={event=>event.currentTarget.select()} onKeyDown={event=>handleCellKey(event,studentIndex,itemIndex)} onChange={event=>setGradeValue(student.id,item,Number(event.target.value))}/></td>;})}<td className="section-total">{sectionTotal(student)}</td><td className="overall"><b>{result.earned}</b><small>{result.percentage}٪</small></td><td className="row-action"><button type="button" onClick={()=>clearRow(student.id)}>مسح الوحدة</button></td></tr>;
      })}{!visibleStudents.length?<tr><td className="empty" colSpan={(section?.items.length||0)+5}>{loading?"جارٍ تحميل الطلاب…":"لا توجد أسماء مطابقة."}</td></tr>:null}</tbody></table></div>
      <footer><span>Enter ينقلك تلقائيًا للطالب التالي داخل نفس عنصر التقييم.</span><span>{session.subject||"المادة"} • {selectedClass||"—"}</span></footer>
    </section>
  </main>;
}
