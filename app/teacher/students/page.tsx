"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";
import { useTeacherClient } from "../../../lib/teacher-client";
import { saveLocalClasses, saveLocalRoster, type UnifiedStudent } from "../../../lib/unified-roster";
import "./students-v9.css";

type Student = { id:string;code:string;name:string;grade:number;section:string;className:string;active:boolean };
type SchoolClass = { id:string;grade:number;section:string;name:string;active:boolean };

async function fetchJson(input:RequestInfo|URL,init:RequestInit={},timeoutMs=10000){const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),timeoutMs);try{const response=await fetch(input,{...init,cache:"no-store",signal:controller.signal});const data=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(data.message||"تعذر تنفيذ العملية") as Error&{status?:number};error.status=response.status;throw error;}return data;}finally{window.clearTimeout(timer);}}
async function fetchRoster(subjectId:string,grade:number|null){const params=new URLSearchParams({subjectId});if(grade)params.set("grade",String(grade));return fetchJson(`/api/teacher/students?${params}`);}
async function fetchClassOptions(subjectId:string,grade:number|null){if(!grade)return{availableClasses:[],selectedClassIds:[]};return fetchJson(`/api/teacher/class-options?subjectId=${encodeURIComponent(subjectId)}&grade=${grade}`);}

export default function StudentsPage(){
  const session=useTeacherClient();
  const subjectId=session?.subjectKey||"";const activeGrade=session?.activeGrade||null;const workspaceKey=session?.workspaceKey||subjectId;const teacherId=session?.teacherId||"";
  const [students,setStudents]=useState<Student[]>([]);const [classes,setClasses]=useState<SchoolClass[]>([]);const [availableClasses,setAvailableClasses]=useState<SchoolClass[]>([]);const [selectedClassIds,setSelectedClassIds]=useState<string[]>([]);const [selectedClass,setSelectedClass]=useState("");const [search,setSearch]=useState("");const [message,setMessage]=useState("");const [loading,setLoading]=useState(false);const [loadingOptions,setLoadingOptions]=useState(false);const [savingScope,setSavingScope]=useState(false);const [managing,setManaging]=useState(false);const [qrStudent,setQrStudent]=useState<Student|null>(null);const [pdfBusy,setPdfBusy]=useState(false);

  async function load(showMessage=false){if(!subjectId)return;setLoading(true);if(!showMessage)setMessage("");try{const data=await fetchRoster(subjectId,activeGrade);const nextStudents=Array.isArray(data.students)?data.students:[];const nextClasses=Array.isArray(data.classes)?data.classes:[];setStudents(nextStudents);setClasses(nextClasses);setSelectedClass(current=>current&&nextClasses.some((item:SchoolClass)=>item.id===current)?current:(nextClasses[0]?.id||""));if(teacherId){saveLocalRoster(teacherId,nextStudents as UnifiedStudent[],workspaceKey);saveLocalClasses(teacherId,nextClasses.map((item:SchoolClass)=>item.name),workspaceKey);}}catch(error){setMessage(error instanceof Error?error.message:"تعذر تحميل قائمة الطلاب");}finally{setLoading(false);}}
  async function loadClassOptions(){if(!subjectId||!activeGrade)return;setLoadingOptions(true);try{const data=await fetchClassOptions(subjectId,activeGrade);setAvailableClasses(Array.isArray(data.availableClasses)?data.availableClasses:[]);setSelectedClassIds(Array.isArray(data.selectedClassIds)?data.selectedClassIds:[]);}catch(error){setMessage(error instanceof Error?error.message:"تعذر تحميل فصول المرحلة");}finally{setLoadingOptions(false);}}
  useEffect(()=>{void load();},[subjectId,activeGrade,workspaceKey,teacherId]);

  const activeClass=classes.find(item=>item.id===selectedClass);
  const visible=useMemo(()=>students.filter(student=>{const classMatch=!activeClass||(student.grade===activeClass.grade&&student.section===activeClass.section);const query=search.trim().toLocaleLowerCase("ar");return classMatch&&(!query||student.name.toLocaleLowerCase("ar").includes(query)||student.code.toLowerCase().includes(query));}).sort((a,b)=>a.name.localeCompare(b.name,"ar")),[students,activeClass,search]);
  const classMetrics=useMemo(()=>classes.map(item=>({ ...item,count:students.filter(student=>student.grade===item.grade&&student.section===item.section).length })),[classes,students]);
  const averageClassSize=classes.length?Math.round(students.length/classes.length):0;

  function toggleClass(classId:string){setSelectedClassIds(current=>current.includes(classId)?current.filter(item=>item!==classId):[...current,classId]);}
  async function openManager(){setManaging(true);await loadClassOptions();}
  async function saveClassScope(){if(!subjectId||!activeGrade)return;setSavingScope(true);setMessage("");try{await fetchJson("/api/teacher/class-scope",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({subjectId,grade:activeGrade,selectedClassIds})});setMessage("تم حفظ فصولك. ستظهر نفس الفصول في المتابعة والتحصيل والتقارير.");setManaging(false);await load(true);}catch(error){setMessage(error instanceof Error?error.message:"تعذر حفظ الفصول");}finally{setSavingScope(false);}}

  function exportExcel(){const rows=visible.map((student,index)=>({م:index+1,"اسم الطالب":student.name,"الفصل":student.className,"كود الطالب":student.code}));if(!rows.length)return setMessage("لا توجد أسماء للتصدير");const workbook=XLSX.utils.book_new();const sheet=XLSX.utils.json_to_sheet(rows);sheet["!cols"]=[{wch:6},{wch:34},{wch:18},{wch:16}];XLSX.utils.book_append_sheet(workbook,sheet,"الطلاب");XLSX.writeFile(workbook,`طلاب-${activeClass?.name||session?.activeGradeLabel||"المادة"}.xlsx`);}

  async function exportPdf(){const target=document.getElementById("teacher-student-roster-print");if(!target||!visible.length)return setMessage("اختر فصلًا يحتوي على طلاب أولًا.");setPdfBusy(true);setMessage("");try{const html2canvas=(await import("html2canvas")).default;const{jsPDF}=await import("jspdf");const canvas=await html2canvas(target,{scale:1.8,backgroundColor:"#ffffff",useCORS:true});const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});const margin=7,usableW=196,usableH=283,imgW=usableW,imgH=canvas.height*imgW/canvas.width,data=canvas.toDataURL("image/png");const pages=Math.max(1,Math.ceil(imgH/usableH));for(let page=0;page<pages;page++){if(page)pdf.addPage();pdf.addImage(data,"PNG",margin,margin-page*usableH,imgW,imgH);}pdf.save(`كشف-${activeClass?.name||"الطلاب"}.pdf`);setMessage("تم إنشاء كشف الفصل PDF.");}catch{setMessage("تعذر إنشاء PDF الآن.");}finally{setPdfBusy(false);}}

  return <main className="students-v9" dir="rtl">
    <section className="sv9-hero"><div><small>إدارة الطلاب</small><h1>فصولك أولًا، ثم الطلاب</h1><p>الأسماء تأتي من سجل الإدارة المركزي. أنت تختار الفصول التي تدرّسها، وبعدها تستخدم نفس القوائم في المتابعة والتحصيل والتقارير.</p></div><button type="button" onClick={()=>void openManager()}>إدارة فصولي</button></section>
    {message?<p className="sv9-message">{message}</p>:null}

    <section className="sv9-overview"><article><small>الطلاب المرتبطون</small><b>{students.length}</b><span>في المادة الحالية</span></article><article><small>فصولي</small><b>{classes.length}</b><span>{session?.activeGradeLabel||"المرحلة الحالية"}</span></article><article><small>متوسط حجم الفصل</small><b>{averageClassSize}</b><span>طالب تقريبًا</span></article><article><small>جاهزية القوائم</small><b>{classes.length&&students.length?"جاهزة":"تحتاج إعداد"}</b><span>للمتابعة والتحصيل</span></article></section>

    <section className="sv9-section-head"><div><small>فصولي التعليمية</small><h2>اختر الفصل الذي تريد العمل عليه</h2></div><button type="button" onClick={()=>void load()} disabled={loading}>{loading?"جارٍ التحديث...":"تحديث القوائم"}</button></section>
    <section className="sv9-class-grid">{classMetrics.map(item=><button type="button" key={item.id} className={selectedClass===item.id?"active":""} onClick={()=>setSelectedClass(item.id)}><span>{item.grade}/{item.section}</span><div><small>فصل تعليمي</small><b>{item.name}</b><em>{item.count} طالب</em></div><i>فتح ←</i></button>)}{!classes.length&&!loading?<div className="sv9-empty"><b>لم تحدد فصولك بعد</b><span>اضغط «إدارة فصولي» واختر الفصول التي تدرّسها.</span><button type="button" onClick={()=>void openManager()}>اختيار الفصول</button></div>:null}</section>

    {activeClass?<section className="sv9-roster">
      <header><div><small>القائمة الحالية</small><h2>{activeClass.name}</h2><p>{visible.length} طالب ظاهر الآن</p></div><div className="sv9-roster-actions"><button type="button" onClick={exportExcel}>Excel</button><button type="button" onClick={()=>void exportPdf()} disabled={pdfBusy}>{pdfBusy?"جارٍ PDF...":"PDF"}</button></div></header>
      <div className="sv9-search"><label><span>بحث سريع</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="اسم الطالب أو الكود"/></label><div><b>{activeClass.name}</b><small>{students.filter(student=>student.grade===activeClass.grade&&student.section===activeClass.section).length} طالب في السجل</small></div></div>
      <div id="teacher-student-roster-print" className="sv9-print-area"><div className="sv9-print-head"><div><small>بوابة أستاذ لحوني التعليمية</small><h3>كشف طلاب {activeClass.name}</h3><p>{session?.subject||"المادة"} • {session?.activeGradeLabel||""} • المعلم: {session?.teacherName||"المعلم"}</p></div><img src="/icons/lahooni-identity-320.jpg" alt="هوية البوابة"/></div><div className="sv9-student-list">{visible.map((student,index)=><article key={student.id}><b>{index+1}</b><div><strong>{student.name}</strong><small>{student.className}</small></div><code>{student.code}</code><button className="no-print" type="button" onClick={()=>setQrStudent(student)}>بطاقة الدخول</button></article>)}</div></div>
    </section>:null}

    {managing?<div className="sv9-modal" role="dialog" aria-modal="true"><section><header><div><small>إدارة الفصول</small><h2>ما الفصول التي تدرّسها؟</h2><p>حددها مرة واحدة، وستستخدمها جميع صفحات بوابة المعلم.</p></div><button type="button" onClick={()=>setManaging(false)}>×</button></header><div className="sv9-class-options">{loadingOptions?<p>جارٍ تحميل الفصول…</p>:availableClasses.map(item=><label key={item.id} className={selectedClassIds.includes(item.id)?"selected":""}><input type="checkbox" checked={selectedClassIds.includes(item.id)} onChange={()=>toggleClass(item.id)}/><span>{item.grade}/{item.section}</span><div><b>{item.name}</b><small>{selectedClassIds.includes(item.id)?"محدد ضمن فصولك":"متاح للاختيار"}</small></div></label>)}</div><footer><button type="button" onClick={()=>setManaging(false)}>إلغاء</button><button className="primary" type="button" onClick={()=>void saveClassScope()} disabled={savingScope||loadingOptions}>{savingScope?"جارٍ الحفظ...":"اعتماد فصولي"}</button></footer></section></div>:null}

    {qrStudent?<div className="sv9-modal" role="dialog" aria-modal="true"><section className="sv9-qr"><header><div><small>بطاقة دخول الطالب</small><h2>{qrStudent.name}</h2><p>{qrStudent.className}</p></div><button type="button" onClick={()=>setQrStudent(null)}>×</button></header><QRCodeSVG value={`${window.location.origin}/student/qr/${qrStudent.code}`} size={220}/><strong>{qrStudent.code}</strong><small>يمكن للطالب وولي الأمر استخدام الرمز نفسه.</small></section></div>:null}
  </main>;
}
