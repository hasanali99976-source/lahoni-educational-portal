"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useTeacherClient } from "../../../lib/teacher-client";
import { ACADEMIC_UNITS, FINAL_MAX, RESEARCH_MAX, UNIT_MAX } from "../../../lib/academic-config";
import { tenantStudentsPath, type ClientTenant } from "../../../lib/firestore-tenant-client";
import "./teacher-ai.css";

type UnitRecord = { attendance?:number; participation?:number; homework?:number; unitExam?:number; exam1?:number; exam2?:number; total?:number };
type Student = { id:string; name?:string; nationalId?:string; class?:string; research?:number; researchScore?:number; units?:Record<string,UnitRecord> };
type Skill = { title:string; score:number; action:string };

function unitTotal(unit?:UnitRecord){
  if(!unit) return 0;
  return Number(unit.total ?? (Number(unit.attendance||0)+Number(unit.participation||0)+Number(unit.homework||0)+Number(unit.unitExam??unit.exam1??unit.exam2??0)));
}
function studentAnalysis(student:Student){
  let unitsTotal=0, recorded=0;
  const component={attendance:0,participation:0,homework:0,exam:0};
  ACADEMIC_UNITS.forEach(unit=>{const value=student.units?.[unit.key];if(!value)return;recorded++;unitsTotal+=Math.min(UNIT_MAX,unitTotal(value));component.attendance+=Number(value.attendance||0);component.participation+=Number(value.participation||0);component.homework+=Number(value.homework||0);component.exam+=Number(value.unitExam??value.exam1??value.exam2??0)});
  const research=Math.min(RESEARCH_MAX,Number(student.researchScore??student.research??0));
  const maximum=recorded*UNIT_MAX+RESEARCH_MAX;
  const total=unitsTotal+research;
  const percentage=maximum?Math.round(total/maximum*100):0;
  const divisor=Math.max(recorded,1);
  const skills:Skill[]=[
    {title:"الحضور والانضباط",score:Math.round(component.attendance/divisor),action:"متابعة الحضور يوميًا وتعزيز الالتزام بمهمة قصيرة في بداية الحصة."},
    {title:"المشاركة الصفية",score:Math.round(component.participation/divisor),action:"إشراك الطالب في سؤال تمهيدي ونشاط ثنائي مع تغذية راجعة فورية."},
    {title:"الواجبات والتطبيق",score:Math.round(component.homework/divisor),action:"تكليف الطالب بتدريبات متدرجة قصيرة مع تصحيح مباشر وإعادة المحاولة."},
    {title:"الاختبارات وفهم المفاهيم",score:Math.round(component.exam/divisor),action:"شرح مصغر للمفاهيم الأقل إتقانًا ثم تقويم من ثلاثة أسئلة متدرجة."},
  ].sort((a,b)=>a.score-b.score);
  const level=percentage>=90?"متميز":percentage>=80?"جيد جدًا":percentage>=70?"جيد":percentage>=60?"مقبول":"يحتاج دعمًا";
  return {total,maximum,percentage,level,recorded,research,skills};
}

export default function TeacherAiPage(){
  const session=useTeacherClient();
  const tenant:ClientTenant|null=session?.teacherId&&session?.subjectKey?{teacherId:session.teacherId,teacherName:session.teacherName||"",subjectKey:session.subjectKey as any}:null;
  const [students,setStudents]=useState<Student[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [mode,setMode]=useState<"plan"|"analysis">("plan");
  const subject=session?.subject||"المادة الحالية";

  useEffect(()=>{
    if(!tenant)return;
    return onSnapshot(collection(db,tenantStudentsPath(tenant)),snap=>{
      const list=snap.docs.map(doc=>({id:doc.id,...doc.data()} as Student)).sort((a,b)=>(a.name||"").localeCompare(b.name||"","ar"));
      setStudents(list);setSelectedId(current=>current||list[0]?.id||"");
    });
  },[tenant?.teacherId,tenant?.subjectKey]);

  const selected=students.find(student=>student.id===selectedId);
  const result=selected?studentAnalysis(selected):null;
  const classStats=useMemo(()=>{
    const analyzed=students.map(studentAnalysis);if(!analyzed.length)return{average:0,highest:0,lowest:0,needsSupport:0};
    const percentages=analyzed.map(item=>item.percentage);
    return{average:Math.round(percentages.reduce((a,b)=>a+b,0)/percentages.length),highest:Math.max(...percentages),lowest:Math.min(...percentages),needsSupport:percentages.filter(value=>value<60).length};
  },[students]);

  function printReport(nextMode:"plan"|"analysis"){
    setMode(nextMode);
    document.body.dataset.aiPrint=nextMode;
    window.setTimeout(()=>window.print(),80);
  }

  return <main className="teacher-ai-page" dir="rtl">
    <section className="teacher-ai-hero no-print"><div><span>AI</span><h1>المساعد الذكي للمعلم</h1><p>مرتبط بدرجات طلاب مادة {subject} لإنشاء خطة علاجية وتحليل نتائج فعلي.</p></div><div className="teacher-ai-status"><i/><b>متصل ببيانات الدرجات</b><small>{students.length} طالبًا في المادة الحالية</small></div></section>

    <section className="ai-control-card no-print">
      <div><label>اختر الطالب</label><select value={selectedId} onChange={e=>setSelectedId(e.target.value)}><option value="">اختر طالبًا</option>{students.map(student=><option key={student.id} value={student.id}>{student.name||student.nationalId||"طالب"} — {student.class||"دون فصل"}</option>)}</select></div>
      <button className={mode==="plan"?"active":""} onClick={()=>setMode("plan")}>الخطة العلاجية</button>
      <button className={mode==="analysis"?"active":""} onClick={()=>setMode("analysis")}>تحليل النتائج</button>
    </section>

    {!selected&&<section className="ai-empty no-print"><strong>اختر طالبًا من القائمة</strong><p>سيقرأ المساعد درجات الطالب ويعرض التحليل والخطة العلاجية تلقائيًا.</p></section>}

    {selected&&result&&<>
      <section className="student-ai-summary no-print"><div><small>الطالب</small><strong>{selected.name||"—"}</strong><span>{selected.class||"لم يحدد الفصل"}</span></div><article><small>النتيجة</small><b>{result.total} / {result.maximum}</b></article><article><small>النسبة</small><b>{result.percentage}%</b></article><article><small>المستوى</small><b>{result.level}</b></article></section>

      {mode==="plan"&&<section className="ai-report-card no-print"><header><div><span>الخطة العلاجية الذكية</span><h2>خطة مخصصة للطالب {selected.name}</h2><p>مبنية على أضعف محاور الأداء المسجلة في درجات الطالب.</p></div><button onClick={()=>printReport("plan")}>طباعة الخطة PDF</button></header><div className="remedial-grid">{result.skills.slice(0,4).map((skill,index)=><article key={skill.title}><em>{index+1}</em><div><h3>{skill.title}</h3><small>مؤشر الأداء المسجل: {skill.score}</small><p>{skill.action}</p></div></article>)}</div><div className="plan-cycle"><b>دورة التنفيذ المقترحة</b><span>الأسبوع الأول: تشخيص وشرح مصغر</span><span>الأسبوع الثاني: تدريب موجه</span><span>الأسبوع الثالث: تطبيق مستقل</span><span>الأسبوع الرابع: تقويم بعدي ومقارنة النتائج</span></div></section>}

      {mode==="analysis"&&<section className="ai-report-card no-print"><header><div><span>تحليل النتائج الذكي</span><h2>تحليل أداء {selected.name}</h2><p>قراءة مباشرة للدرجات المسجلة مع توصيات قابلة للتنفيذ.</p></div><button onClick={()=>printReport("analysis")}>تقرير التحليل PDF</button></header><div className="analysis-stats"><article><small>متوسط الصف</small><b>{classStats.average}%</b></article><article><small>أعلى نتيجة</small><b>{classStats.highest}%</b></article><article><small>أقل نتيجة</small><b>{classStats.lowest}%</b></article><article><small>طلاب يحتاجون دعمًا</small><b>{classStats.needsSupport}</b></article></div><div className="analysis-list">{result.skills.map(skill=><div key={skill.title}><span><b>{skill.title}</b><small>{skill.action}</small></span><strong>{skill.score}</strong></div>)}</div><div className="ai-conclusion"><b>الخلاصة</b><p>مستوى الطالب الحالي «{result.level}» بنسبة {result.percentage}%. الأولوية هي البدء بمحور «{result.skills[0]?.title}»، ثم متابعة التحسن أسبوعيًا وإعادة القياس بعد أربعة أسابيع.</p></div></section>}
    </>}

    {selected&&result&&<section className="ai-print-report print-only">
      <header><strong>بوابة أستاذ لحوني التعليمية</strong><span>{mode==="plan"?"الخطة العلاجية الذكية":"تقرير تحليل النتائج"}</span></header>
      <div className="print-student"><h1>{selected.name||"الطالب"}</h1><p>المادة: {subject} | الفصل: {selected.class||"—"} | المعلم: {session?.teacherName||"—"}</p><p>النتيجة: {result.total} من {result.maximum} — النسبة: {result.percentage}% — المستوى: {result.level}</p></div>
      {mode==="plan"?<div className="print-plan">{result.skills.map((skill,index)=><article key={skill.title}><h2>{index+1}. {skill.title}</h2><p><b>المؤشر:</b> {skill.score}</p><p>{skill.action}</p></article>)}<h2>الجدول الزمني</h2><p>أربعة أسابيع: تشخيص، تدريب موجه، تطبيق مستقل، ثم تقويم بعدي.</p></div>:<div className="print-analysis"><h2>ملخص التحليل</h2><p>متوسط الصف {classStats.average}%، أعلى نتيجة {classStats.highest}%، أقل نتيجة {classStats.lowest}%، وعدد الطلاب المحتاجين للدعم {classStats.needsSupport}.</p>{result.skills.map(skill=><article key={skill.title}><h3>{skill.title}: {skill.score}</h3><p>{skill.action}</p></article>)}<h2>التوصية النهائية</h2><p>تبدأ المعالجة بمحور {result.skills[0]?.title}، مع قياس أسبوعي وتوثيق التحسن وإعادة التقويم بعد أربعة أسابيع.</p></div>}
      <footer><span>بوابة أستاذ لحوني التعليمية</span><span>تاريخ التقرير: {new Date().toLocaleDateString("ar-SA")}</span></footer>
    </section>}
  </main>;
}
