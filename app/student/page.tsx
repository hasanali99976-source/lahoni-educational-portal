"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import "./student.css";

type UnitRecord = { total?: number; attendance?: number; participation?: number; homework?: number; unitExam?: number };
type StudentRecord = { name?: string; الاسم?: string; class?: string; الفئة?: string; nationalId?: string; researchScore?: number; units?: Record<string, UnitRecord>; [key: string]: unknown };
type AttendanceStatus = "present" | "absent" | "late" | "excused";
type AttendanceDoc = { records?: Record<string, AttendanceStatus> };

const units = [["unit1","الوحدة الأولى"],["unit2","الوحدة الثانية"],["unit3","الوحدة الثالثة"],["unit4","الوحدة الرابعة"],["unit5","الوحدة الخامسة"]] as const;

export default function StudentPage(){
  const [nationalId,setNationalId]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);
  const [student,setStudent]=useState<StudentRecord|null>(null);
  const [studentDocId,setStudentDocId]=useState("");
  const [attendanceDocs,setAttendanceDocs]=useState<AttendanceDoc[]>([]);

  async function findStudent(id:string){
    const result=await getDocs(query(collection(db,"students"),where("nationalId","==",id)));
    if(!result.empty) return {id:result.docs[0].id,data:result.docs[0].data() as StudentRecord};
    const legacy=await getDocs(query(collection(db,"الطلاب"),where("nationalId","==",id)));
    if(!legacy.empty) return {id:legacy.docs[0].id,data:legacy.docs[0].data() as StudentRecord};
    return null;
  }

  async function submit(idOverride?:string){
    const id=(idOverride??nationalId).replace(/\D/g,"");
    setMessage(""); setStudent(null); setStudentDocId("");
    if(!/^\d{10}$/.test(id)) return setMessage("أدخل رقم هوية صحيحًا من 10 أرقام");
    try{
      setLoading(true); setNationalId(id);
      const found=await findStudent(id);
      if(!found) return setMessage("لم يتم العثور على طالب بهذا الرقم");
      setStudent(found.data); setStudentDocId(found.id);
    }catch{setMessage("تعذر قراءة البيانات الآن. حاول مرة أخرى.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get("nationalId")?.replace(/\D/g,"")||"";
    if(/^\d{10}$/.test(id)) void submit(id);
  },[]);

  useEffect(()=>{
    if(!studentDocId) return;
    const unsubStudent=onSnapshot(doc(db,"students",studentDocId),snap=>{if(snap.exists()) setStudent(snap.data() as StudentRecord);});
    const unsubAttendance=onSnapshot(collection(db,"attendance"),snap=>setAttendanceDocs(snap.docs.map(d=>d.data() as AttendanceDoc)));
    return ()=>{unsubStudent();unsubAttendance();};
  },[studentDocId]);

  const name=String(student?.name??student?.الاسم??"الطالب");
  const studentClass=String(student?.class??student?.الفئة??"غير محدد");
  const unitRows=useMemo(()=>units.map(([key,label])=>{
    const r=student?.units?.[key]||{};
    const attendance=Number(r.attendance||0),participation=Number(r.participation||0),homework=Number(r.homework||0),unitExam=Number(r.unitExam||0);
    const total=Number(r.total??attendance+participation+homework+unitExam);
    return {key,label,attendance,participation,homework,unitExam,total};
  }),[student]);
  const research=Number(student?.researchScore||0);
  const finalTotal=unitRows.reduce((sum,u)=>sum+u.total,0)+research;
  const attendanceSummary=useMemo(()=>{
    const r={present:0,absent:0,late:0,excused:0};
    if(!studentDocId) return r;
    attendanceDocs.forEach(d=>{const s=d.records?.[studentDocId]; if(s) r[s]+=1;});
    return r;
  },[attendanceDocs,studentDocId]);
  const recorded=Object.values(attendanceSummary).reduce((a,b)=>a+b,0);
  const attendanceRate=recorded?Math.round(attendanceSummary.present/recorded*100):0;

  return <main className="parent-portal" dir="rtl">
    <section className="parent-hero">
      <div className="parent-hero-image" />
      <div className="parent-hero-overlay">
        <div className="school-mark">ت</div>
        <div><span>مدرسة التهذيب الثانوية</span><h1>بوابة الطالب وولي الأمر</h1><p>متابعة مباشرة لدرجات مادة التاريخ والحضور.</p><b>الأستاذ حسن علي الطويل</b></div>
      </div>
    </section>

    <section className="parent-login-card">
      <div><h2>الدخول إلى التقرير</h2><p>أدخل السجل المدني للطالب.</p></div>
      <div className="parent-login-form"><input inputMode="numeric" value={nationalId} onChange={e=>setNationalId(e.target.value.replace(/\D/g,"").slice(0,10))} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="رقم الهوية الوطنية"/><button onClick={()=>submit()} disabled={loading}>{loading?"جارٍ التحميل...":"عرض التقرير"}</button></div>
      {message&&<p className="parent-error">{message}</p>}
    </section>

    {student&&studentDocId&&<section className="parent-report">
      <header className="parent-student-head"><div><small>اسم الطالب</small><h2>{name}</h2><p>{studentClass} • السجل المدني: {student.nationalId??nationalId}</p></div><div><span>المجموع النهائي</span><strong>{finalTotal}</strong><small>من ١٠٠</small></div></header>

      <section className="parent-stats">
        <article><span>أيام الغياب</span><strong>{attendanceSummary.absent}</strong></article>
        <article><span>مرات التأخر</span><strong>{attendanceSummary.late}</strong></article>
        <article><span>مرات الاستئذان</span><strong>{attendanceSummary.excused}</strong></article>
        <article><span>نسبة الحضور</span><strong>{attendanceRate}%</strong></article>
      </section>

      <section className="parent-unit-cards">{unitRows.map(u=><article key={u.key}><span>{u.label}</span><strong>{u.total}</strong><small>من ١٩</small></article>)}<article className="parent-research"><span>البحث</span><strong>{research}</strong><small>من ٥</small></article></section>

      <section className="parent-table-card"><div><h2>تفصيل درجات الوحدات</h2><p>تتحدث البيانات تلقائيًا بعد حفظ المعلم.</p></div><div className="parent-table-wrap"><table><thead><tr><th>الوحدة</th><th>الحضور<br/><small>١</small></th><th>المشاركة<br/><small>٢</small></th><th>الواجبات<br/><small>٢</small></th><th>الاختبار<br/><small>١٤</small></th><th>المجموع<br/><small>١٩</small></th></tr></thead><tbody>{unitRows.map(u=><tr key={u.key}><td><b>{u.label}</b></td><td>{u.attendance}</td><td>{u.participation}</td><td>{u.homework}</td><td>{u.unitExam}</td><td><strong>{u.total}</strong></td></tr>)}</tbody><tfoot><tr><td colSpan={5}>البحث</td><td>{research} / ٥</td></tr><tr><td colSpan={5}>المجموع النهائي</td><td>{finalTotal} / ١٠٠</td></tr></tfoot></table></div></section>
    </section>}
  </main>;
}
