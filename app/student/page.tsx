"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import "./student.css";

type UnitRecord = { total?: number; attendance?: number; participation?: number; homework?: number; unitExam?: number };
type StudentRecord = { name?: string; الاسم?: string; class?: string; الفئة?: string; nationalId?: string; accessCode?: string; researchScore?: number; teacherNote?: string; parentCounselorNoticeSentAt?: string; parentCounselorNoticeSeenAt?: string; units?: Record<string, UnitRecord>; [key: string]: unknown };
type AttendanceStatus = "present" | "absent" | "late" | "excused";
type AttendanceDoc = { records?: Record<string, AttendanceStatus> };

const units = [["unit1","الوحدة الأولى"],["unit2","الوحدة الثانية"],["unit3","الوحدة الثالثة"],["unit4","الوحدة الرابعة"],["unit5","الوحدة الخامسة"]] as const;
function encouragement(score:number){
  if(score>=95)return{title:"مبدع يا بطل!",text:"نتيجة رائعة جدًا، استمر بهذا التميز والمحافظة على مستواك العالي.",tone:"excellent"};
  if(score>=90)return{title:"ممتاز جدًا",text:"أداء قوي ومشرّف، بقيت لمسات بسيطة للوصول إلى القمة.",tone:"excellent"};
  if(score>=80)return{title:"أحسنت يا بطل",text:"مستواك جميل، ومع قليل من التركيز تستطيع تحقيق نتيجة أعلى.",tone:"good"};
  if(score>=70)return{title:"تقدم جيد",text:"أنت على الطريق الصحيح، ركّز على البنود الأقل درجة وستتطور بسرعة.",tone:"good"};
  if(score>=60)return{title:"واصل ولا تتوقف",text:"لديك أساس جيد، تحتاج إلى مزيد من المراجعة والاهتمام بالاختبارات والواجبات.",tone:"needs-work"};
  return{title:"يبي لك تشد حيلك",text:"ابدأ بخطوات بسيطة، راجع وحداتك أولًا بأول واطلب المساعدة عند الحاجة.",tone:"needs-work"};
}

export default function StudentPage(){
  const [nationalId,setNationalId]=useState("");
  const [accessCode,setAccessCode]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);
  const [student,setStudent]=useState<StudentRecord|null>(null);
  const [studentDocId,setStudentDocId]=useState("");
  const [attendanceDocs,setAttendanceDocs]=useState<AttendanceDoc[]>([]);
  const [showCounselorNotice,setShowCounselorNotice]=useState(false);

  async function findStudent(id:string,code:string){
    const result=await getDocs(query(collection(db,"students"),where("nationalId","==",id),where("accessCode","==",code)));
    if(!result.empty)return{id:result.docs[0].id,data:result.docs[0].data() as StudentRecord};
    return null;
  }
  async function submit(idOverride?:string,codeOverride?:string){
    const id=(idOverride??nationalId).replace(/\D/g,"");
    const code=(codeOverride??accessCode).trim().toUpperCase();
    setMessage("");setStudent(null);setStudentDocId("");setShowCounselorNotice(false);
    if(!/^\d{10}$/.test(id))return setMessage("أدخل رقم هوية صحيحًا من 10 أرقام");
    if(!/^TH\d{4}$/.test(code))return setMessage("أدخل كود ولي الأمر الصحيح");
    if(code!==`TH${id.slice(-4)}`)return setMessage("رقم الهوية أو كود ولي الأمر غير صحيح");
    try{setLoading(true);setNationalId(id);setAccessCode(code);const found=await findStudent(id,code);if(!found)return setMessage("رقم الهوية أو كود ولي الأمر غير صحيح");setStudent(found.data);setStudentDocId(found.id);setShowCounselorNotice(Boolean(found.data.parentCounselorNoticeSentAt&&!found.data.parentCounselorNoticeSeenAt));}catch{setMessage("تعذر قراءة البيانات الآن. حاول مرة أخرى.");}finally{setLoading(false);}
  }
  useEffect(()=>{const code=(new URLSearchParams(window.location.search).get("code")||"").trim().toUpperCase();if(/^TH\d{4}$/.test(code))setAccessCode(code);},[]);
  useEffect(()=>{if(!studentDocId)return;const unsubStudent=onSnapshot(doc(db,"students",studentDocId),snap=>{if(snap.exists()){const data=snap.data() as StudentRecord;setStudent(data);setShowCounselorNotice(Boolean(data.parentCounselorNoticeSentAt&&!data.parentCounselorNoticeSeenAt));}});const unsubAttendance=onSnapshot(collection(db,"attendance"),snap=>setAttendanceDocs(snap.docs.map(d=>d.data() as AttendanceDoc));return()=>{unsubStudent();unsubAttendance();};},[studentDocId]);
  useEffect(()=>{if(!showCounselorNotice||!studentDocId)return;const timer=window.setTimeout(async()=>{try{await updateDoc(doc(db,"students",studentDocId),{parentCounselorNoticeSeenAt:new Date().toISOString()});}catch{}},3000);return()=>window.clearTimeout(timer);},[showCounselorNotice,studentDocId]);

  const name=String(student?.name??student?.الاسم??"الطالب");
  const studentClass=String(student?.class??student?.الفئة??"غير محدد");
  const teacherNote=String(student?.teacherNote||"").trim();
  const unitRows=useMemo(()=>units.map(([key,label])=>{const r=student?.units?.[key]||{};const attendance=Number(r.attendance||0),participation=Number(r.participation||0),homework=Number(r.homework||0),unitExam=Number(r.unitExam||0);return{key,label,attendance,participation,homework,unitExam,total:Number(r.total??attendance+participation+homework+unitExam)};}),[student]);
  const research=Number(student?.researchScore||0);
  const finalTotal=unitRows.reduce((sum,u)=>sum+u.total,0)+research;
  const motivational=encouragement(finalTotal);
  const attendanceSummary=useMemo(()=>{const r={present:0,absent:0,late:0,excused:0};if(!studentDocId)return r;attendanceDocs.forEach(d=>{const status=d.records?.[studentDocId];if(status)r[status]+=1;});return r;},[attendanceDocs,studentDocId]);
  const recorded=Object.values(attendanceSummary).reduce((a,b)=>a+b,0);const attendanceRate=recorded?Math.round(attendanceSummary.present/recorded*100):0;

  return <main className="parent-portal" dir="rtl">
    <section className="parent-hero"><div className="parent-hero-image"/><div className="parent-hero-overlay"><div className="school-mark">ت</div><div><span>مدرسة التهذيب الثانوية</span><h1>بوابة الطالب وولي الأمر</h1><p>متابعة مباشرة لدرجات مادة التاريخ والحضور.</p><b>الأستاذ حسن علي الطويل</b></div></div><small className="parent-prepared-by">إعداد / الأستاذ حسن علي الطويل</small></section>
    <section className="parent-login-card"><div><h2>الدخول الآمن إلى التقرير</h2></div><div className="parent-login-form parent-secure-login"><input inputMode="numeric" value={nationalId} onChange={e=>setNationalId(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="رقم الهوية الوطنية"/><input dir="ltr" autoCapitalize="characters" value={accessCode} onChange={e=>setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6))} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="كود ولي الأمر"/><button onClick={()=>submit()} disabled={loading}>{loading?"جارٍ التحقق...":"عرض التقرير"}</button></div>{message&&<p className="parent-error">{message}</p>}</section>
    {student&&studentDocId&&<section className="parent-report">
      {showCounselorNotice&&<section className="parent-counselor-notice"><div className="parent-counselor-icon">📢</div><div><strong>تنبيه مهم لولي الأمر</strong><p>تم رفع اسم الطالب للموجه الطلابي لأول مرة لمتابعة مستوى الإتقان في مادة التاريخ. نأمل متابعة مستوى الطالب ودعمه للوصول إلى مستوى الإتقان المطلوب.</p></div></section>}
      <header className="parent-student-head"><div><small>اسم الطالب</small><h2>{name}</h2><p>{studentClass} • السجل المدني: {student.nationalId??nationalId}</p></div><div className="parent-score-and-message"><div className="parent-final-score"><span>المجموع النهائي</span><strong>{finalTotal}</strong><small>من ١٠٠</small></div><div className={`parent-encouragement ${motivational.tone}`}><b>{motivational.title}</b><p>{motivational.text}</p></div></div></header>
      {teacherNote&&<section className="parent-teacher-note"><div>✦</div><article><span>ملاحظة المعلم</span><p>{teacherNote}</p><small>الأستاذ حسن علي الطويل</small></article></section>}
      <section className="parent-stats"><article><span>أيام الغياب</span><strong>{attendanceSummary.absent}</strong></article><article><span>مرات التأخر</span><strong>{attendanceSummary.late}</strong></article><article><span>مرات الاستئذان</span><strong>{attendanceSummary.excused}</strong></article><article><span>نسبة الحضور</span><strong>{attendanceRate}%</strong></article></section>
      <section className="parent-unit-cards">{unitRows.map(u=><article key={u.key}><span>{u.label}</span><strong>{u.total}</strong><small>من ١٩</small></article>)}<article className="parent-research"><span>البحث</span><strong>{research}</strong><small>من ٥</small></article></section>
      <section className="parent-table-card"><div><h2>تفصيل درجات الوحدات</h2><p>تتحدث البيانات تلقائيًا بعد حفظ المعلم.</p></div><div className="parent-table-wrap"><table><thead><tr><th>الوحدة</th><th>الحضور<br/><small>١</small></th><th>المشاركة<br/><small>٢</small></th><th>الواجبات<br/><small>٢</small></th><th>الاختبار<br/><small>١٤</small></th><th>المجموع<br/><small>١٩</small></th></tr></thead><tbody>{unitRows.map(u=><tr key={u.key}><td><b>{u.label}</b></td><td>{u.attendance}</td><td>{u.participation}</td><td>{u.homework}</td><td>{u.unitExam}</td><td><strong>{u.total}</strong></td></tr>)}</tbody><tfoot><tr><td colSpan={5}>البحث</td><td>{research} / ٥</td></tr><tr><td colSpan={5}>المجموع النهائي</td><td>{finalTotal} / ١٠٠</td></tr></tfoot></table></div></section>
      <small className="parent-report-credit">إعداد / الأستاذ حسن علي الطويل</small>
    </section>}
  </main>;
}
