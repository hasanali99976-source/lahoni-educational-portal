"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useTeacherClient } from "../../../lib/teacher-client";
import { calculateGradePlanResult, type GradeStudentLike } from "../../../lib/grade-plan";
import { useGradePlan } from "../../../lib/use-grade-plan";
import TeacherCompetitionProgress from "../competition-progress";
import "./report-v9.css";

type Student = GradeStudentLike & { id:string;code:string;name:string;class:string;className:string;teacherNotes?:unknown[] };
type NoteRow = {studentCode:string;notes:Array<{message?:string;label?:string;createdAt?:string}>};
type AttendanceStatus = "present"|"absent"|"late"|"excused"|"escaped";
type AttendanceRecord = { class?:string;date?:string;records?:Record<string,AttendanceStatus> };
type ScopeMode = "classes" | "students";

const ar = (value:number) => new Intl.NumberFormat("ar-SA-u-nu-arab",{maximumFractionDigits:1}).format(Number.isFinite(value)?value:0);
const palette = ["#0b716b","#3a67a8","#8a5a9b","#c27a34","#43845e","#9a4f61"];

function Bars({rows}:{rows:Array<{label:string;value:number;color:string;sub?:string}>}) {
  const max = Math.max(100,...rows.map(row=>row.value));
  return <div className="trv9-bars">{rows.map(row=><article key={row.label}><div><b>{row.label}</b><small>{row.sub||""}</small></div><i><u style={{width:`${Math.max(2,row.value/max*100)}%`,background:row.color}}/></i><strong>{ar(row.value)}٪</strong></article>)}</div>;
}

function Donut({value,label}:{value:number;label:string}) {
  const safe=Math.max(0,Math.min(100,value));
  return <div className="trv9-donut" style={{background:`conic-gradient(var(--subject) ${safe*3.6}deg,#e8efed 0deg)`}}><span><b>{ar(safe)}٪</b><small>{label}</small></span></div>;
}

export default function TeacherReportPage(){
  const session=useTeacherClient();
  const {activePlan}=useGradePlan(true);
  const [students,setStudents]=useState<Student[]>([]);
  const [attendance,setAttendance]=useState<AttendanceRecord[]>([]);
  const [noteRows,setNoteRows]=useState<NoteRow[]>([]);
  const [masterySectionId,setMasterySectionId]=useState("");
  const [masteryThreshold,setMasteryThreshold]=useState(80);
  const [mode,setMode]=useState<ScopeMode>("classes");
  const [selectedClasses,setSelectedClasses]=useState<string[]>([]);
  const [selectedStudents,setSelectedStudents]=useState<string[]>([]);
  const [studentClassFilter,setStudentClassFilter]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    if(!session?.subjectKey)return;
    const params=new URLSearchParams({subjectId:session.subjectKey});
    if(session.activeGrade)params.set("grade",String(session.activeGrade));
    params.set("fresh","1");
    const controller=new AbortController();
    Promise.all([
      fetch(`/api/teacher/students?${params}`,{cache:"no-store",signal:controller.signal}),
      fetch(`/api/teacher/grade-data?subjectId=${encodeURIComponent(session.subjectKey)}`,{cache:"no-store",signal:controller.signal}),
      fetch(`/api/teacher/notes?subjectId=${encodeURIComponent(session.subjectKey)}`,{cache:"no-store",signal:controller.signal}),
    ]).then(async ([rosterResponse,gradesResponse,notesResponse])=>{
      const [roster,grades,notes]=await Promise.all([rosterResponse.json(),gradesResponse.json(),notesResponse.json()]);
      if(!rosterResponse.ok||!gradesResponse.ok||!notesResponse.ok)throw new Error(roster.message||grades.message||notes.message||"تعذر تحميل بيانات التقرير");
      const byCode=grades.byCode&&typeof grades.byCode==="object"?grades.byCode as Record<string,Record<string,unknown>>:{};
      const list=(Array.isArray(roster.students)?roster.students:[]).map((value:Record<string,unknown>)=>{
        const code=String(value.code||value.id||"").trim().toUpperCase();
        const className=String(value.className||value.class||"").trim();
        const academic=byCode[code]||{};
        return{...(value as unknown as Student),...academic,id:code,code,name:String(value.name||"").trim(),class:className,className} as Student;
      }).filter((student:Student)=>student.id&&student.name&&student.class);
      const codes=new Set(list.map((student:Student)=>student.code));
      if(!controller.signal.aborted){
        setStudents(list);
        setNoteRows((Array.isArray(notes.rows)?notes.rows:[]).filter((row:NoteRow)=>codes.has(String(row.studentCode||"").trim().toUpperCase())));
        setMessage("");
      }
    }).catch(error=>{if(!controller.signal.aborted)setMessage(error instanceof Error?error.message:"تعذر تحميل الطلاب");});
    return()=>controller.abort();
  },[session?.subjectKey,session?.activeGrade]);

  useEffect(()=>{
    if(!session?.subjectKey)return;
    const controller=new AbortController();
    const formatter=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"});
    const toDate=new Date();
    const fromDate=new Date(toDate.getTime()-30*86_400_000);
    const params=new URLSearchParams({subjectId:session.subjectKey,mode:"range",from:formatter.format(fromDate),to:formatter.format(toDate)});
    fetch(`/api/teacher/attendance-report?${params.toString()}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل الحضور");return data;})
      .then(data=>setAttendance(Array.isArray(data.attendance)?data.attendance:[]))
      .catch(error=>{if((error as Error)?.name!=="AbortError")setAttendance([]);});
    return()=>controller.abort();
  },[session?.subjectKey]);

  const masterySections=activePlan?.sections||[];
  const masterySection=masterySections.find(section=>section.id===masterySectionId)||masterySections[0];
  const classes=useMemo(()=>[...new Set(students.map(student=>student.class).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
  useEffect(()=>{if(!classes.length){setSelectedClasses([]);return;}setSelectedClasses(current=>current.length?current.filter(item=>classes.includes(item)):[classes[0]]);},[classes.join("|")]);

  const analyses=useMemo(()=>students.map(student=>{
    const result=activePlan?calculateGradePlanResult(activePlan,student):null;
    const average=result?Math.round(result.percentage):0;
    const statuses=attendance.map(record=>record.records?.[student.id]).filter(Boolean);
    const absent=statuses.filter(status=>status==="absent"||status==="escaped").length;
    const late=statuses.filter(status=>status==="late").length;
    const present=statuses.filter(status=>status==="present"||status==="excused").length;
    const total=statuses.length;
    const attendanceRate=total?Math.round((present+late*.5)/total*100):100;
    const noteCount=noteRows.find(row=>String(row.studentCode).trim().toUpperCase()===student.code)?.notes.length||0;
    const section=result?.sections.find(item=>item.id===masterySection?.id);
    const masteryPercentage=section&&section.recordedMaximum>0?Math.round(section.percentage):null;
    const masteryStatus=masteryPercentage===null?"غير مرصود":masteryPercentage>=masteryThreshold?"متقن":"يحتاج دعمًا";
    return{...student,average,absent,late,attendanceRate,noteCount,completion:result?.completion||0,masteryPercentage,masteryStatus};
  }),[students,attendance,activePlan,noteRows,masterySection?.id,masteryThreshold]);

  const studentCandidates=useMemo(()=>analyses.filter(student=>!studentClassFilter||student.class===studentClassFilter).sort((a,b)=>a.name.localeCompare(b.name,"ar")),[analyses,studentClassFilter]);
  const selected=useMemo(()=>mode==="classes"?analyses.filter(student=>selectedClasses.includes(student.class)):analyses.filter(student=>selectedStudents.includes(student.id)),[analyses,mode,selectedClasses,selectedStudents]);

  const classStats=useMemo(()=>selectedClasses.map((name,index)=>{
    const rows=analyses.filter(student=>student.class===name);const graded=rows.filter(student=>student.average>0);
    return{name,count:rows.length,average:graded.length?Math.round(graded.reduce((sum,student)=>sum+student.average,0)/graded.length):0,support:rows.filter(student=>student.average>0&&student.average<60).length,excellent:rows.filter(student=>student.average>=90).length,attendance:rows.length?Math.round(rows.reduce((sum,student)=>sum+student.attendanceRate,0)/rows.length):100,notes:rows.reduce((sum,student)=>sum+student.noteCount,0),color:palette[index%palette.length]};
  }),[analyses,selectedClasses]);

  const studentStats=useMemo(()=>selected.map((student,index)=>({label:student.name,value:student.average,color:palette[index%palette.length],sub:student.class,attendance:student.attendanceRate,notes:student.noteCount})),[selected]);
  const graded=selected.filter(student=>student.average>0);
  const overall=graded.length?Math.round(graded.reduce((sum,student)=>sum+student.average,0)/graded.length):0;
  const attendanceAverage=selected.length?Math.round(selected.reduce((sum,student)=>sum+student.attendanceRate,0)/selected.length):100;
  const support=selected.filter(student=>student.average>0&&student.average<60).length;
  const excellent=selected.filter(student=>student.average>=90).length;
  const totalNotes=selected.reduce((sum,student)=>sum+student.noteCount,0);
  const masteryRecorded=selected.filter(student=>student.masteryPercentage!==null);
  const masteryAverage=masteryRecorded.length?Math.round(masteryRecorded.reduce((sum,student)=>sum+(student.masteryPercentage||0),0)/masteryRecorded.length):null;
  const masteryAchieved=selected.filter(student=>student.masteryStatus==="متقن").length;
  const masterySupport=selected.filter(student=>student.masteryStatus==="يحتاج دعمًا").length;
  const completionAverage=selected.length?Math.round(selected.reduce((sum,student)=>sum+student.completion,0)/selected.length):0;

  function toggleClass(name:string){setSelectedClasses(current=>current.includes(name)?current.filter(item=>item!==name):[...current,name]);}
  function toggleStudent(id:string){setSelectedStudents(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);}
  function chooseMode(next:ScopeMode){setMode(next);setMessage("");if(next==="students"&&!selectedStudents.length&&analyses[0])setSelectedStudents([analyses[0].id]);}

  function exportExcel(){
    if(!selected.length)return setMessage("حدد عناصر التقرير أولًا.");
    const workbook=XLSX.utils.book_new();
    if(mode==="classes")selectedClasses.forEach(className=>{const rows=selected.filter(student=>student.class===className).map((student,index)=>({م:index+1,"اسم الطالب":student.name,"الفصل":student.class,"التحصيل %":student.average,"الحضور %":student.attendanceRate,"الغياب":student.absent,"الملاحظات":student.noteCount,"الإتقان %":student.masteryPercentage??"غير مرصود","حالة الإتقان":student.masteryStatus}));const sheet=XLSX.utils.json_to_sheet(rows);sheet["!cols"]=[{wch:6},{wch:32},{wch:16},{wch:13},{wch:13},{wch:10},{wch:12}];XLSX.utils.book_append_sheet(workbook,sheet,className.slice(0,31));});
    else{const rows=selected.map((student,index)=>({م:index+1,"اسم الطالب":student.name,"الفصل":student.class,"التحصيل %":student.average,"اكتمال الرصد %":student.completion,"الحضور %":student.attendanceRate,"الغياب":student.absent,"التأخر":student.late,"الملاحظات":student.noteCount}));const sheet=XLSX.utils.json_to_sheet(rows);sheet["!cols"]=[{wch:6},{wch:32},{wch:16},{wch:13},{wch:16},{wch:13},{wch:10},{wch:10},{wch:12}];XLSX.utils.book_append_sheet(workbook,sheet,"الطلاب المختارون");}
    XLSX.writeFile(workbook,`ملخص-عمل-${session?.subject||"المادة"}.xlsx`);
  }

  async function exportPdf(){
    const report=document.getElementById("teacher-report-v9-print");if(!report||!selected.length)return setMessage("حدد عناصر التقرير أولًا.");setBusy(true);setMessage("");
    try{const html2canvas=(await import("html2canvas")).default;const{jsPDF}=await import("jspdf");const canvas=await html2canvas(report,{scale:1.65,backgroundColor:"#ffffff",useCORS:true});const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});const margin=7,usableW=196,usableH=283,imgW=usableW,imgH=canvas.height*imgW/canvas.width,data=canvas.toDataURL("image/png");const pages=Math.max(1,Math.ceil(imgH/usableH));for(let page=0;page<pages;page++){if(page)pdf.addPage();pdf.addImage(data,"PNG",margin,margin-page*usableH,imgW,imgH);}pdf.save(`ملخص-عمل-${session?.teacherName||"المعلم"}.pdf`);}catch{setMessage("تعذر إنشاء PDF الآن.");}finally{setBusy(false);}
  }

  const chartRows=mode==="classes"?classStats.map(item=>({label:item.name,value:item.average,color:item.color,sub:`${item.count} طالب`})):studentStats;

  return <main className="teacher-report-v9" dir="rtl">
    <section className="trv9-hero"><div><small>ملخص عمل المعلم</small><h1>اختر نوع التقرير أولًا</h1><p>بدل جدول طويل من البداية، حدد هل تريد مقارنة فصول أو تحليل طلاب محددين، ثم تظهر الرسوم والبيانات المناسبة فقط.</p></div><TeacherCompetitionProgress compact/></section>
    {message?<p className="trv9-message">{message}</p>:null}

    <section className="trv9-mode"><button className={mode==="classes"?"active":""} onClick={()=>chooseMode("classes")}><span>▦</span><div><b>تقرير فصول</b><small>مقارنة فصل أو عدة فصول</small></div></button><button className={mode==="students"?"active":""} onClick={()=>chooseMode("students")}><span>◎</span><div><b>تقرير طلاب</b><small>طالب واحد أو مجموعة محددة</small></div></button></section>

    <section className="trv9-scope"><header><div><small>مؤشرات الإتقان</small><h2>المهارة أو الفترة ومعيار الإتقان</h2></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><select aria-label="فترة الإتقان" value={masterySection?.id||""} onChange={event=>setMasterySectionId(event.target.value)}>{masterySections.map(section=><option key={section.id} value={section.id}>{section.label}</option>)}</select><select aria-label="نسبة معيار الإتقان" value={masteryThreshold} onChange={event=>setMasteryThreshold(Number(event.target.value))}>{[60,70,80,90].map(value=><option key={value} value={value}>معيار {value}٪</option>)}</select></div></header></section>
    <section className="trv9-scope">
      {mode==="classes"?<><header><div><small>الفصول داخل التقرير</small><h2>اختر ما تريد مقارنته</h2></div><button onClick={()=>setSelectedClasses(classes)}>تحديد الكل</button></header><div className="trv9-class-picker">{classes.map((name,index)=><button key={name} className={selectedClasses.includes(name)?"active":""} style={{"--tone":palette[index%palette.length]} as React.CSSProperties} onClick={()=>toggleClass(name)}><b>{name}</b><small>{analyses.filter(student=>student.class===name).length} طالب</small></button>)}</div></>:<><header><div><small>الطلاب داخل التقرير</small><h2>اختر الأسماء المطلوبة</h2></div><label>تصفية حسب الفصل<select value={studentClassFilter} onChange={event=>setStudentClassFilter(event.target.value)}><option value="">جميع الفصول</option>{classes.map(name=><option key={name}>{name}</option>)}</select></label></header><div className="trv9-student-picker">{studentCandidates.map(student=><button key={student.id} className={selectedStudents.includes(student.id)?"active":""} onClick={()=>toggleStudent(student.id)}><span>{selectedStudents.includes(student.id)?"✓":"+"}</span><div><b>{student.name}</b><small>{student.class} • {student.average?`${student.average}٪`:"غير مرصود"}</small></div></button>)}</div></>}
      <footer><span>المحدد: <b>{mode==="classes"?selectedClasses.length:selectedStudents.length}</b></span><div><button onClick={exportExcel}>Excel</button><button className="primary" disabled={busy} onClick={()=>void exportPdf()}>{busy?"جارٍ التجهيز…":"PDF"}</button></div></footer>
    </section>

    <section id="teacher-report-v9-print" className="trv9-report">
      <header className="trv9-print-head"><div><small>بوابة أستاذ لحوني التعليمية</small><h2>{mode==="classes"?"تقرير مقارنة الفصول":"تقرير الطلاب المختارين"}</h2><p>{session?.subject||"المادة"} • {session?.activeGradeLabel||""} • المعلم: {session?.teacherName||"المعلم"}</p></div><img src="/icons/lahooni-identity-320.jpg" alt="هوية البوابة"/></header>
      <section className="trv9-kpis"><article><small>{mode==="classes"?"الطلاب داخل الفصول":"الطلاب المختارون"}</small><b>{ar(selected.length)}</b></article><article><small>متوسط التحصيل</small><b>{ar(overall)}٪</b></article><article><small>متوسط الحضور</small><b>{ar(attendanceAverage)}٪</b></article><article><small>متميزون</small><b>{ar(excellent)}</b></article><article><small>يحتاجون دعمًا</small><b>{ar(support)}</b></article><article><small>الملاحظات</small><b>{ar(totalNotes)}</b></article><article><small>متوسط الإتقان</small><b>{masteryAverage===null?"غير مرصود":`${ar(masteryAverage)}٪`}</b></article><article><small>متقنون</small><b>{ar(masteryAchieved)}</b></article><article><small>غير متقنين</small><b>{ar(masterySupport)}</b></article></section>
      <section className="trv9-graphs">
        <article><header><div><small>المقارنة الرئيسية</small><h3>{mode==="classes"?"متوسط التحصيل بين الفصول":"تحصيل الطلاب المختارين"}</h3></div></header><Bars rows={chartRows}/></article>
        <article className="trv9-donuts"><header><small>صورة عامة</small><h3>التحصيل والحضور واكتمال الرصد</h3></header><div><Donut value={overall} label="التحصيل"/><Donut value={attendanceAverage} label="الحضور"/><Donut value={completionAverage} label="اكتمال الرصد"/><Donut value={masteryAverage||0} label={`إتقان ${masterySection?.label||""}`}/></div></article>
      </section>
      {mode==="classes"?<section className="trv9-comparison"><header><h3>مقارنة مؤشرات الفصول</h3></header><div>{classStats.map(item=><article key={item.name} style={{borderTopColor:item.color}}><header><b>{item.name}</b><span>{ar(item.average)}٪</span></header><dl><div><dt>الحضور</dt><dd>{ar(item.attendance)}٪</dd></div><div><dt>متميزون</dt><dd>{ar(item.excellent)}</dd></div><div><dt>دعم</dt><dd>{ar(item.support)}</dd></div><div><dt>ملاحظات</dt><dd>{ar(item.notes)}</dd></div><div><dt>متقنون</dt><dd>{ar(analyses.filter(student=>student.class===item.name&&student.masteryStatus==="متقن").length)}</dd></div></dl></article>)}</div></section>:<section className="trv9-student-summary"><header><h3>الطلاب داخل التقرير</h3></header><div>{selected.map(student=><article key={student.id}><div><b>{student.name}</b><small>{student.class}</small></div><span>{ar(student.average)}٪<small>تحصيل</small></span><span>{ar(student.attendanceRate)}٪<small>حضور</small></span><span>{ar(student.completion)}٪<small>رصد</small></span><span>{student.masteryPercentage===null?"—":`${ar(student.masteryPercentage)}٪`}<small>{student.masteryStatus}</small></span><span>{ar(student.noteCount)}<small>ملاحظات</small></span></article>)}</div></section>}
    </section>
  </main>;
}
