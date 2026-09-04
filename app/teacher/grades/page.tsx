"use client";

import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
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
import { downloadGradebookPdfDocument, type GradebookPdfClass } from "../../../lib/grades-pdf";
import "./grades-v10.css";

type LegacyUnit=Record<string,unknown>;
type Student=GradeStudentLike&{
  id:string;code:string;name:string;class:string;className:string;
  gradeValues?:GradeValueMap;gradePlanValues?:Record<string,GradeValueMap>;units?:Record<string,LegacyUnit>;notes?:string;
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
  const [pdfBusy,setPdfBusy]=useState(false);
  const [allPdfBusy,setAllPdfBusy]=useState(false);

  useEffect(()=>{
    if(!tenant)return;
    const controller=new AbortController();const params=new URLSearchParams({subjectId:tenant.subjectKey});if(session.activeGrade)params.set("grade",String(session.activeGrade));setLoading(true);setMessage("");
    fetch(`/api/teacher/students?${params.toString()}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل الطلاب");return data;})
      .then(data=>{const list:Student[]=(Array.isArray(data.students)?data.students:[]).map((value:Record<string,unknown>)=>{const code=String(value.code||value.id||"").trim().toUpperCase();const className=String(value.className||value.class||"").trim();return{...(value as unknown as Student),id:code,code,name:String(value.name||"").trim(),class:className,className,gradeValues:value.gradeValues&&typeof value.gradeValues==="object"?value.gradeValues as GradeValueMap:{}};}).filter((student:Student)=>Boolean(student.id&&student.name&&student.class));list.sort((a,b)=>a.class.localeCompare(b.class,"ar",{numeric:true})||a.name.localeCompare(b.name,"ar"));setStudents(list);})
      .catch(error=>{if((error as Error)?.name!=="AbortError")setMessage(error instanceof Error?error.message:"تعذر تحميل طلاب المادة الحالية");}).finally(()=>setLoading(false));
    return()=>controller.abort();
  },[tenant,session.activeGrade]);

  const classes=useMemo(()=>[...new Set(students.map(student=>student.class))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
  const classStudents=useMemo(()=>students.filter(student=>student.class===selectedClass),[students,selectedClass]);
  const visibleStudents=useMemo(()=>{const q=search.trim().toLocaleLowerCase("ar");return classStudents.filter(student=>!q||student.name.toLocaleLowerCase("ar").includes(q)||student.code.toLowerCase().includes(q));},[classStudents,search]);
  const section=useMemo(()=>activePlan?.sections.find(item=>item.id===selectedSection)||activePlan?.sections[0]||null,[activePlan,selectedSection]);

  useEffect(()=>{if(!classes.length){setSelectedClass("");return;}if(!selectedClass||!classes.includes(selectedClass))setSelectedClass(classes[0]);},[classes,selectedClass]);
  useEffect(()=>{if(!activePlan?.sections.length){setSelectedSection("");return;}if(!selectedSection||!activePlan.sections.some(item=>item.id===selectedSection))setSelectedSection(activePlan.sections[0].id);},[activePlan,selectedSection]);
  useEffect(()=>{
    if(!section){setLocalValues({});return;}const next:LocalValues={};classStudents.forEach(student=>{const row:GradeValueMap={};section.items.forEach(item=>{const entry=readGradeEntry(studentForPlan(student),section,item);row[entry.key]=clamp(entry.value,item.max);});next[student.id]=row;});setLocalValues(next);setDirty(false);
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

  const aiInsight=classAnalytics.support?`${classAnalytics.support} طالب في الفصل تحت 60٪. بعد الحفظ راجع الإتقان والمهارة لتحديد التدخل المناسب.`:classAnalytics.completion<100?`اكتمال الرصد للفصل ${classAnalytics.completion}٪. ركز على الخانات الناقصة قبل الحكم على مستوى الطالب.`:"الرصد مكتمل بدرجة جيدة. يمكنك الآن الانتقال للمقارنة بين الفصول أو الإتقان والمهارة.";

  async function saveRegister(){
    if(!tenant||!selectedClass||!activePlan||!section)return setMessage("اختر الفصل أولًا");setSaving(true);
    try{const now=new Date().toISOString();await Promise.all(classStudents.map(student=>{const mergedValues={...valuesForPlan(student),...(localValues[student.id]||{})};return setDoc(doc(db,tenantStudentsPath(tenant),student.id),{name:student.name,class:student.class,className:student.class,code:student.code,active:true,rosterActive:true,gradeValues:mergedValues,gradePlanValues:{...(student.gradePlanValues||{}),[activePlan.id]:mergedValues},activeGradePlanId:activePlan.id,activeGradePlanVersion:activePlan.version,gradePlanUpdatedAt:now,teacherId:tenant.teacherId,subjectKey:tenant.subjectKey},{merge:true});}));
      setStudents(current=>current.map(student=>classStudents.some(item=>item.id===student.id)?{...student,gradeValues:{...valuesForPlan(student),...(localValues[student.id]||{})},gradePlanValues:{...(student.gradePlanValues||{}),[activePlan.id]:{...valuesForPlan(student),...(localValues[student.id]||{})}}}:student));setDirty(false);setMessage(`تم حفظ ${section.label} لفصل ${selectedClass}.`);
    }catch(error){console.error("gradebook-save-v10",error);setMessage("تعذر حفظ الدرجات الآن.");}finally{setSaving(false);}
  }

  function exportExcel(){
    if(!activePlan||!section||!classStudents.length)return setMessage("اختر فصلًا يحتوي على طلاب أولًا");const rows=classStudents.map((student,index)=>{const source=effectiveStudent(student);const sectionResult=calculateGradePlanResult(activePlan,source).sections.find(item=>item.id===section.id);const row:Record<string,string|number>={"م":index+1,"اسم الطالب":student.name,"الفصل":student.class};section.items.forEach(item=>{row[`${item.label} (من ${item.max})`]=readGradeEntry(source,section,item).value;});row[`المجموع (من ${section.max})`]=sectionResult?.earned||0;row["نسبة الخطة الحالية"]=calculateGradePlanResult(activePlan,source).percentage;return row;});const workbook=XLSX.utils.book_new();const sheet=XLSX.utils.json_to_sheet(rows);sheet["!cols"]=Object.keys(rows[0]||{}).map((key,index)=>({wch:index===1?30:Math.max(12,Math.min(24,key.length+3))}));XLSX.utils.book_append_sheet(workbook,sheet,section.label.slice(0,28)||"الدرجات");XLSX.writeFile(workbook,`درجات-${selectedClass}-${section.label}.xlsx`);
  }
  function buildPdfClass(className:string):GradebookPdfClass|null{
    if(!activePlan)return null;const roster=students.filter(student=>student.class===className).sort((a,b)=>a.name.localeCompare(b.name,"ar"));if(!roster.length)return null;
    return{className,sections:activePlan.sections.map(planSection=>({id:planSection.id,label:planSection.label,max:planSection.max,columns:planSection.items.map(item=>({id:item.id,label:item.label,max:item.max})),rows:roster.map((student,index)=>{const source=className===selectedClass?effectiveStudent(student):studentForPlan(student);const result=calculateGradePlanResult(activePlan,source);const sectionResult=result.sections.find(item=>item.id===planSection.id);return{number:index+1,name:student.name,values:planSection.items.map(item=>readGradeEntry(source,planSection,item).value),sectionTotal:sectionResult?.earned||0,overallTotal:result.earned,percentage:result.percentage};})}))};
  }
  async function downloadCurrentClassGradesPdf(){if(!activePlan||!selectedClass)return setMessage("اختر الفصل أولًا.");const report=buildPdfClass(selectedClass);if(!report)return setMessage("لا توجد أسماء طلاب في الفصل المحدد.");setPdfBusy(true);setMessage("جارٍ تجهيز التقرير الأكاديمي PDF...");try{const result=await downloadGradebookPdfDocument({portalName:"بوابة أستاذ لحوني التعليمية",teacherName:session.teacherName||"المعلم",subject:session.subject||"المادة",gradeLabel:session.activeGradeLabel||"",planLabel:GRADE_PLAN_MODE_LABELS[activePlan.mode],planVersion:activePlan.version,classes:[report],fileName:`التحصيل-${selectedClass.replace(/[\\/:*?"<>|]/g,"-")}.pdf`});setMessage(`تم إنشاء تقرير الفصل: ${result.studentCount} طالب.`);}catch{setMessage("تعذر إنشاء تقرير PDF الآن.");}finally{setPdfBusy(false);}}
  async function downloadAllClassesGradesPdf(){if(!activePlan||!classes.length)return setMessage("لا توجد فصول متاحة للطباعة.");setAllPdfBusy(true);setMessage("جارٍ تجهيز تقارير جميع الفصول...");try{const reports=classes.map(buildPdfClass).filter((item):item is GradebookPdfClass=>!!item);const result=await downloadGradebookPdfDocument({portalName:"بوابة أستاذ لحوني التعليمية",teacherName:session.teacherName||"المعلم",subject:session.subject||"المادة",gradeLabel:session.activeGradeLabel||"",planLabel:GRADE_PLAN_MODE_LABELS[activePlan.mode],planVersion:activePlan.version,classes:reports,fileName:`التحصيل-جميع-الفصول-${(session.subject||"المادة").replace(/[\\/:*?"<>|]/g,"-")}.pdf`});setMessage(`تم إنشاء ${result.classCount} تقارير فصول.`);}catch{setMessage("تعذر إنشاء تقارير جميع الفصول.");}finally{setAllPdfBusy(false);}}

  if(planLoading)return <main className="grades-v10"><section className="gv10-state">جارٍ تحميل الخطة الدراسية…</section></main>;
  if(!activePlan)return <main className="grades-v10"><section className="gv10-no-plan"><small>التحصيل العلمي</small><h2>لا توجد خطة درجات معتمدة بعد</h2><p>اعتمد هيكلة الدرجات أولًا، وبعدها يعود الرصد هنا تلقائيًا.</p>{planError?<span>{planError}</span>:null}<Link href="/teacher/grade-plan">فتح الخطة الدراسية</Link></section></main>;

  return <main className="grades-v10" dir="rtl">
    {message?<p className="gv10-message">{message}</p>:null}
    <section className="gv10-command">
      <div className="gv10-selectors"><label><span>الفصل</span><select value={selectedClass} onChange={event=>{setSelectedClass(event.target.value);setSearch("");}}>{classes.map(name=><option key={name}>{name}</option>)}</select></label>{activePlan.sections.length>1?<label><span>{activePlan.mode==="units"?"الوحدة":"الفترة / القسم"}</span><select value={selectedSection} onChange={event=>setSelectedSection(event.target.value)}>{activePlan.sections.map(item=><option key={item.id} value={item.id}>{item.label} — {item.max} درجة</option>)}</select></label>:null}<label className="gv10-search"><span>بحث</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="اسم الطالب أو الكود"/></label></div>
      <div className="gv10-command-actions"><details><summary>تصدير التقرير</summary><div><button type="button" onClick={exportExcel}>Excel للفصل</button><button type="button" onClick={()=>void downloadCurrentClassGradesPdf()} disabled={pdfBusy}>{pdfBusy?"جارٍ التجهيز…":"PDF الفصل"}</button><button type="button" onClick={()=>void downloadAllClassesGradesPdf()} disabled={allPdfBusy}>{allPdfBusy?"جارٍ التجهيز…":"PDF جميع الفصول"}</button></div></details><button type="button" className={`gv10-save ${dirty?"dirty":""}`} onClick={()=>void saveRegister()} disabled={!selectedClass||saving}>{saving?"جارٍ الحفظ…":dirty?"حفظ التغييرات":"محفوظ"}</button></div>
    </section>

    <section className="gv10-overview"><article><small>طلاب الفصل</small><b>{classStudents.length}</b><span>{selectedClass||"—"}</span></article><article><small>متوسط التحصيل</small><b>{classAnalytics.average?`${classAnalytics.average}٪`:"—"}</b><span>حسب الرصد الحالي</span></article><article><small>اكتمال الرصد</small><b>{classAnalytics.completion}٪</b><span>{classAnalytics.complete} طالب مكتمل</span></article><article><small>يحتاجون دعمًا</small><b>{classAnalytics.support}</b><span>{classAnalytics.excellent} متميز</span></article></section>

    <section className="gv10-ai"><span>AI</span><div><small>قراءة الفصل</small><b>{selectedClass||"اختر الفصل"}</b><p>{aiInsight}</p></div><Link href="/teacher/follow-up">فتح الإتقان والمهارة</Link></section>

    <section className="gv10-register">
      <header><div><small>الخطة المعتمدة • نسخة {activePlan.version}</small><h2>{section?.label}</h2><p>{section?.items.length||0} عناصر تقييم • مجموع القسم {section?.max||0} درجة</p></div><span>{dirty?"توجد تغييرات غير محفوظة":"الرصد محفوظ"}</span></header>
      <div className="gv10-table-wrap"><table><thead><tr><th className="num">م</th><th className="name">اسم الطالب</th>{section?.items.map(item=><th key={item.id}><span>{item.label}</span><small>من {item.max}</small><button type="button" onClick={()=>applyFullGrade(item)}>الدرجة الكاملة للكل</button></th>)}<th>مجموع القسم<small>من {section?.max}</small></th><th>التحصيل الحالي<small>من 100</small></th><th className="row-action">إجراء</th></tr></thead><tbody>{visibleStudents.map((student,studentIndex)=>{const source=effectiveStudent(student);const result=calculateGradePlanResult(activePlan,source);return <tr key={student.id}><td className="num">{studentIndex+1}</td><td className="name"><b>{student.name}</b><small>{student.code} • {result.completion}٪ رصد</small></td>{section?.items.map((item,itemIndex)=>{const key=itemKey(item);const value=localValues[student.id]?.[key]??readGradeEntry(student,section,item).value;return <td key={item.id}><input data-grade-cell={`${studentIndex}-${itemIndex}`} type="number" min="0" max={item.max} step="0.5" value={value} onFocus={event=>event.currentTarget.select()} onKeyDown={event=>handleCellKey(event,studentIndex,itemIndex)} onChange={event=>setGradeValue(student.id,item,Number(event.target.value))}/></td>;})}<td className="section-total">{sectionTotal(student)}</td><td className="overall"><b>{result.earned}</b><small>{result.percentage}٪</small></td><td className="row-action"><button type="button" onClick={()=>clearRow(student.id)}>مسح القسم</button></td></tr>;})}{!visibleStudents.length?<tr><td className="empty" colSpan={(section?.items.length||0)+5}>{loading?"جارٍ تحميل الطلاب…":"لا توجد أسماء مطابقة."}</td></tr>:null}</tbody></table></div>
      <footer><span>اضغط Enter داخل خانة الدرجة للانتقال إلى الطالب التالي.</span><span>{session.subject||"المادة"} • {selectedClass||"—"}</span></footer>
    </section>
  </main>;
}
