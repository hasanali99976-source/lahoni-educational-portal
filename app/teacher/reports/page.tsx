"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import {
  calculateGradePlanResult,
  readGradeEntry,
  GRADE_PLAN_MODE_LABELS,
  type GradeStudentLike,
  type GradeValueMap,
} from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import { downloadAttendancePdfDocument, type AttendancePdfClass } from "../../../lib/attendance-pdf";
import { downloadGradebookPdfDocument, type GradebookPdfClass } from "../../../lib/grades-pdf";
import "./reports-v11.css";

type AttendanceStatus="present"|"absent"|"late"|"excused"|"escaped";
type Student=GradeStudentLike&{
  id:string;code?:string;name?:string;class?:string;className?:string;
  gradeValues?:GradeValueMap;gradePlanValues?:Record<string,GradeValueMap>;
};
type AttendanceDoc={class?:string;date?:string;records?:Record<string,AttendanceStatus>};
type ReportType="grades"|"attendance"|"summary";

const STATUS_LABELS:Record<AttendanceStatus,string>={present:"حاضر",absent:"غائب",late:"متأخر",excused:"مستأذن",escaped:"هروب"};
function riyadhDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function hijri(value:string){try{return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura",{day:"numeric",month:"long",year:"numeric"}).format(new Date(`${value}T12:00:00+03:00`));}catch{return value;}}
function safe(value:string){return value.replace(/[\\/:*?"<>|]/g,"-");}

export default function ReportsPage(){
  const session=useTeacherClient();
  const {activePlan,loading:planLoading}=useGradePlan(true);
  const teacherId=session.teacherId||"";
  const subjectKey=session.subjectKey||"history";
  const [students,setStudents]=useState<Student[]>([]);
  const [attendanceDocs,setAttendanceDocs]=useState<AttendanceDoc[]>([]);
  const [reportType,setReportType]=useState<ReportType>("grades");
  const [selectedClasses,setSelectedClasses]=useState<string[]>([]);
  const [selectedSection,setSelectedSection]=useState("all");
  const [selectedDate,setSelectedDate]=useState(riyadhDate());
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    if(!teacherId||!subjectKey)return;
    const controller=new AbortController();
    const params=new URLSearchParams({subjectId:subjectKey});
    if(session.activeGrade)params.set("grade",String(session.activeGrade));
    fetch(`/api/teacher/students?${params.toString()}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل الطلاب");return data;})
      .then(data=>{
        const list:Student[]=(Array.isArray(data.students)?data.students:[]).map((raw:Record<string,unknown>)=>{
          const code=String(raw.code||raw.id||"").trim().toUpperCase();
          const className=String(raw.className||raw.class||"").trim();
          return{...(raw as unknown as Student),id:code,code,name:String(raw.name||"").trim(),class:className,className};
        }).filter((student:Student)=>student.id&&student.name&&student.className);
        list.sort((a,b)=>String(a.className).localeCompare(String(b.className),"ar",{numeric:true})||String(a.name).localeCompare(String(b.name),"ar"));
        setStudents(list);setMessage("");
      }).catch(error=>{if((error as Error)?.name!=="AbortError")setMessage(error instanceof Error?error.message:"تعذر تحميل الطلاب");});
    return()=>controller.abort();
  },[teacherId,subjectKey,session.activeGrade]);

  useEffect(()=>{
    if(!teacherId||!subjectKey)return;
    return onSnapshot(collection(db,tenantCollection(teacherId,subjectKey as never,"attendance")),snapshot=>setAttendanceDocs(snapshot.docs.map(item=>item.data() as AttendanceDoc)),()=>setAttendanceDocs([]));
  },[teacherId,subjectKey]);

  const classes=useMemo(()=>[...new Set(students.map(student=>String(student.className||student.class||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
  useEffect(()=>{if(!selectedClasses.length&&classes.length)setSelectedClasses([classes[0]]);else setSelectedClasses(current=>current.filter(name=>classes.includes(name)));},[classes]);
  useEffect(()=>{if(reportType!=="grades")return;if(selectedSection!=="all"&&!activePlan?.sections.some(section=>section.id===selectedSection))setSelectedSection("all");},[activePlan,reportType,selectedSection]);

  const selectedStudents=useMemo(()=>students.filter(student=>selectedClasses.includes(String(student.className||student.class||""))),[students,selectedClasses]);
  const savedAttendanceClasses=useMemo(()=>new Set(attendanceDocs.filter(item=>item.date===selectedDate&&item.class).map(item=>String(item.class))),[attendanceDocs,selectedDate]);
  const unsavedClasses=selectedClasses.filter(name=>!savedAttendanceClasses.has(name));
  const selectedSectionLabel=selectedSection==="all"?"جميع الوحدات / الفترات":activePlan?.sections.find(item=>item.id===selectedSection)?.label||"—";

  function toggleClass(name:string){setSelectedClasses(current=>current.includes(name)?current.filter(item=>item!==name):[...current,name]);}
  function chooseAll(){setSelectedClasses(classes);}

  function studentForPlan(student:Student){
    if(!activePlan)return student;
    const planValues=student.gradePlanValues?.[activePlan.id];
    return planValues?{...student,gradeValues:planValues}:student;
  }

  function gradeClass(className:string):GradebookPdfClass|null{
    if(!activePlan)return null;
    const roster=students.filter(student=>String(student.className||student.class||"")===className);
    if(!roster.length)return null;
    const planSections=activePlan.sections.filter(section=>selectedSection==="all"||section.id===selectedSection);
    return{className,sections:planSections.map(section=>({
      id:section.id,label:section.label,max:section.max,
      columns:section.items.map(item=>({id:item.id,label:item.label,max:item.max})),
      rows:roster.map((student,index)=>{
        const source=studentForPlan(student);
        const result=calculateGradePlanResult(activePlan,source);
        const sectionResult=result.sections.find(item=>item.id===section.id);
        return{number:index+1,name:String(student.name||""),values:section.items.map(item=>readGradeEntry(source,section,item).value),sectionTotal:sectionResult?.earned||0,overallTotal:result.earned,percentage:result.percentage};
      }),
    }))};
  }

  function attendanceClass(className:string):AttendancePdfClass|null{
    const roster=students.filter(student=>String(student.className||student.class||"")===className);
    const record=attendanceDocs.find(item=>item.class===className&&item.date===selectedDate);
    if(!roster.length||!record)return null;
    const statuses=roster.map(student=>record.records?.[student.id]||record.records?.[String(student.code||"")]||"present" as AttendanceStatus);
    const counts={present:statuses.filter(item=>item==="present").length,absent:statuses.filter(item=>item==="absent").length,late:statuses.filter(item=>item==="late").length,excused:statuses.filter(item=>item==="excused").length,escaped:statuses.filter(item=>item==="escaped").length};
    return{className,counts,rows:roster.map((student,index)=>({number:index+1,name:String(student.name||""),status:STATUS_LABELS[statuses[index]]}))};
  }

  async function generatePdf(){
    if(!selectedClasses.length)return setMessage("اختر فصلًا واحدًا على الأقل.");
    setBusy(true);setMessage("");
    try{
      if(reportType==="grades"){
        if(!activePlan)throw new Error("اعتمد الخطة الدراسية أولًا لإنشاء تقرير التحصيل.");
        const reports=selectedClasses.map(gradeClass).filter((item):item is GradebookPdfClass=>!!item);
        const result=await downloadGradebookPdfDocument({portalName:"بوابة أستاذ لحوني التعليمية",teacherName:session.teacherName||"المعلم",subject:session.subject||"المادة",gradeLabel:session.activeGradeLabel||"",planLabel:GRADE_PLAN_MODE_LABELS[activePlan.mode],planVersion:activePlan.version,classes:reports,fileName:`تقرير-التحصيل-${safe(session.subject||"المادة")}.pdf`});
        setMessage(`تم إنشاء تقرير أكاديمي: ${result.classCount} فصل و${result.studentCount} طالب.`);
      }else if(reportType==="attendance"){
        const reports=selectedClasses.map(attendanceClass).filter((item):item is AttendancePdfClass=>!!item);
        if(!reports.length)throw new Error("لا يوجد سجل متابعة محفوظ للفصول المختارة في هذا التاريخ.");
        const result=await downloadAttendancePdfDocument({portalName:"بوابة أستاذ لحوني التعليمية",teacherName:session.teacherName||"المعلم",subject:session.subject||"المادة",date:selectedDate,hijriDate:hijri(selectedDate),classes:reports,fileName:`سجل-المتابعة-${selectedDate}.pdf`});
        setMessage(`تم إنشاء سجل المتابعة: ${result.classCount} فصل و${result.studentCount} طالب.`);
      }else{
        window.location.assign("/teacher/report");
      }
    }catch(error){setMessage(error instanceof Error?error.message:"تعذر إنشاء التقرير الآن.");}finally{setBusy(false);}
  }

  function exportExcel(){
    if(!selectedClasses.length)return setMessage("اختر فصلًا واحدًا على الأقل.");
    if(reportType==="summary"){window.location.assign("/teacher/report");return;}
    const rows:Record<string,string|number>[]=[];
    if(reportType==="attendance"){
      selectedClasses.forEach(className=>{
        const record=attendanceDocs.find(item=>item.class===className&&item.date===selectedDate);
        students.filter(student=>String(student.className||student.class||"")===className).forEach((student,index)=>{
          const status=(record?.records?.[student.id]||record?.records?.[String(student.code||"")]||"present") as AttendanceStatus;
          rows.push({"م":index+1,"اسم الطالب":String(student.name||""),"الفصل":className,"التاريخ":selectedDate,"الحالة":record?STATUS_LABELS[status]:"غير محفوظ"});
        });
      });
    }else if(activePlan){
      const sections=activePlan.sections.filter(section=>selectedSection==="all"||section.id===selectedSection);
      selectedClasses.forEach(className=>students.filter(student=>String(student.className||student.class||"")===className).forEach((student,index)=>{
        const source=studentForPlan(student);const result=calculateGradePlanResult(activePlan,source);const row:Record<string,string|number>={"م":index+1,"اسم الطالب":String(student.name||""),"الفصل":className};
        sections.forEach(section=>{section.items.forEach(item=>{row[`${section.label} - ${item.label}`]=readGradeEntry(source,section,item).value;});row[`مجموع ${section.label}`]=result.sections.find(item=>item.id===section.id)?.earned||0;});row["المجموع الحالي"]=result.earned;row["النسبة"]=result.percentage;rows.push(row);
      }));
    }
    if(!rows.length)return setMessage("لا توجد بيانات للتصدير.");
    const workbook=XLSX.utils.book_new();const sheet=XLSX.utils.json_to_sheet(rows);sheet["!cols"]=Object.keys(rows[0]).map((key,index)=>({wch:index===1?32:Math.max(12,Math.min(24,key.length+3))}));XLSX.utils.book_append_sheet(workbook,sheet,reportType==="attendance"?"سجل المتابعة":"التحصيل");XLSX.writeFile(workbook,`${reportType==="attendance"?"سجل-المتابعة":"التحصيل"}-${safe(session.subject||"المادة")}.xlsx`);setMessage("تم تجهيز ملف Excel.");
  }

  const previewTitle=reportType==="grades"?"تقرير التحصيل العلمي":reportType==="attendance"?"سجل المتابعة الأكاديمي":"ملخص عمل المعلم";
  const readyCount=reportType==="attendance"?selectedClasses.length-unsavedClasses.length:selectedClasses.length;

  return <main className="smart-reports-v11" dir="rtl">
    <section className="sr11-intro">
      <div><small>مركز التقارير الذكي</small><h2>أنشئ التقرير من احتياجك، لا من زر طباعة</h2><p>اختر نوع التقرير، نطاقه، ثم راجع ما سيدخل في الوثيقة قبل إنشائها. لا يتم تعديل أي بيانات محفوظة أثناء التصدير.</p></div>
      <span className="sr11-safe">قراءة فقط • بياناتك محفوظة</span>
    </section>

    {message?<p className="sr11-message">{message}</p>:null}

    <section className="sr11-builder">
      <aside className="sr11-steps">
        <span className="active"><b>1</b><em>نوع التقرير</em></span>
        <span className={selectedClasses.length?"active":""}><b>2</b><em>الفصول</em></span>
        <span className={selectedClasses.length?"active":""}><b>3</b><em>التفاصيل</em></span>
        <span className={selectedClasses.length?"active":""}><b>4</b><em>المعاينة والإنشاء</em></span>
      </aside>

      <div className="sr11-workspace">
        <section className="sr11-types">
          <button className={reportType==="grades"?"active":""} type="button" onClick={()=>setReportType("grades")}><span>01</span><div><b>التحصيل العلمي</b><small>درجات حسب الوحدة أو الفترة</small></div></button>
          <button className={reportType==="attendance"?"active":""} type="button" onClick={()=>setReportType("attendance")}><span>02</span><div><b>سجل المتابعة</b><small>الحضور والانضباط بتاريخ محدد</small></div></button>
          <button className={reportType==="summary"?"active":""} type="button" onClick={()=>setReportType("summary")}><span>03</span><div><b>ملخص عمل المعلم</b><small>مقارنات ومؤشرات الأداء</small></div></button>
        </section>

        <section className="sr11-config">
          <div className="sr11-class-select">
            <header><div><small>النطاق</small><h3>اختر الفصول</h3></div><button type="button" onClick={chooseAll}>تحديد جميع فصولي</button></header>
            <div>{classes.map(name=><label key={name} className={selectedClasses.includes(name)?"selected":""}><input type="checkbox" checked={selectedClasses.includes(name)} onChange={()=>toggleClass(name)}/><span><b>{name}</b><small>{students.filter(student=>String(student.className||student.class||"")===name).length} طالب</small></span>{reportType==="attendance"?<i className={savedAttendanceClasses.has(name)?"ready":"missing"}>{savedAttendanceClasses.has(name)?"محفوظ":"لا يوجد سجل"}</i>:null}</label>)}</div>
          </div>

          <div className="sr11-detail-select">
            <header><small>تفاصيل التقرير</small><h3>{reportType==="grades"?"ماذا تريد من خطة الدرجات؟":reportType==="attendance"?"أي يوم تريد؟":"نوع القراءة"}</h3></header>
            {reportType==="grades"?<>
              {planLoading?<p>جارٍ تحميل الخطة…</p>:!activePlan?<div className="sr11-warning"><b>لا توجد خطة معتمدة</b><span>يمكنك إعدادها بدون التأثير على البيانات القديمة.</span><Link href="/teacher/grade-plan">فتح الخطة الدراسية</Link></div>:<div className="sr11-section-options"><button type="button" className={selectedSection==="all"?"active":""} onClick={()=>setSelectedSection("all")}><b>جميع الوحدات / الفترات</b><small>تقرير كامل</small></button>{activePlan.sections.map(section=><button type="button" key={section.id} className={selectedSection===section.id?"active":""} onClick={()=>setSelectedSection(section.id)}><b>{section.label}</b><small>{section.max} درجة • {section.items.length} عناصر</small></button>)}</div>}
            </>:reportType==="attendance"?<label className="sr11-date"><span>تاريخ سجل المتابعة</span><input type="date" value={selectedDate} onChange={event=>setSelectedDate(event.target.value)}/><small>{hijri(selectedDate)}</small>{unsavedClasses.length?<em>{unsavedClasses.length} فصل مختار ليس له سجل محفوظ في هذا اليوم.</em>:<em className="good">كل الفصول المختارة جاهزة.</em>}</label>:<div className="sr11-summary-link"><b>الملخص يعتمد على بيانات العمل الفعلية</b><p>المقارنة بين الفصول والطلاب، التحصيل، الحضور، الإتقان والملاحظات تظهر في لوحة ملخص المعلم.</p><Link href="/teacher/report">فتح لوحة التحليل</Link></div>}
          </div>
        </section>

        <section className="sr11-preview">
          <div className="sr11-preview-paper">
            <header><div><small>بوابة أستاذ لحوني التعليمية</small><h3>{previewTitle}</h3></div><span>معاينة</span></header>
            <div className="sr11-preview-meta"><span><small>المعلم</small><b>{session.teacherName||"المعلم"}</b></span><span><small>المادة</small><b>{session.subject||"المادة"}</b></span><span><small>الفصول</small><b>{selectedClasses.length||0}</b></span><span><small>الطلاب</small><b>{selectedStudents.length}</b></span></div>
            <div className="sr11-preview-body"><span/><span/><span/><span/><span/></div>
            <footer><span>{reportType==="grades"?selectedSectionLabel:reportType==="attendance"?`${selectedDate} • ${hijri(selectedDate)}`:"مؤشرات ومقارنات"}</span><b>{readyCount} فصل جاهز</b></footer>
          </div>
          <div className="sr11-preview-actions"><small>الخطوة الأخيرة</small><h3>جاهز لإنشاء الوثيقة؟</h3><p>{reportType==="attendance"&&unsavedClasses.length?"سيتم إنشاء التقرير للفصول التي لديها سجل محفوظ فقط.":"سيتم إنشاء نسخة من البيانات للقراءة والتصدير فقط، بدون أي تعديل على سجلاتك."}</p><div><button className="primary" type="button" onClick={()=>void generatePdf()} disabled={busy||!selectedClasses.length}>{busy?"جارٍ إنشاء التقرير…":"إنشاء PDF أكاديمي"}</button><button type="button" onClick={exportExcel} disabled={busy||!selectedClasses.length}>تصدير Excel</button></div></div>
        </section>
      </div>
    </section>
  </main>;
}
