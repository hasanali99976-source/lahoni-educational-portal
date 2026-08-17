"use client";

import Link from "next/link";
import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import "./student.css";
import "./student-smart.css";
import "./identity.css";
import "./portal-login.css";

type SubjectKey="history"|"critical-thinking";
type AttendanceStatus="present"|"absent"|"late"|"excused"|"escaped";
type UnitRecord={total?:number;attendance?:number;participation?:number;homework?:number;unitExam?:number;exam1?:number;exam2?:number;notes?:string};
type ParentNotice={message?:string;createdAt?:string};
type StudentRecord={name?:string;class?:string;nationalId?:string;accessCode?:string;teacherName?:string;research?:number;researchScore?:number;teacherNote?:string;parentCounselorNoticeCount?:number;parentCounselorLastNotice?:ParentNotice;units?:Record<string,UnitRecord>};
type AttendanceDoc={records?:Record<string,AttendanceStatus>};

const subjects=[
 {key:"history" as const,label:"التاريخ",teacher:"الأستاذ حسن علي الطويل",teacherId:"hasan-history",icon:"🏛️"},
 {key:"critical-thinking" as const,label:"التفكير الناقد",teacher:"الأستاذ عبد الله الرويشد",teacherId:"abdullah-critical-thinking",icon:"🧠"},
];
const units=[["unit1","الوحدة الأولى"],["unit2","الوحدة الثانية"],["unit3","الوحدة الثالثة"],["unit4","الوحدة الرابعة"],["unit5","الوحدة الخامسة"]] as const;
const tenantPath=(teacherId:string,subject:SubjectKey,name:string)=>`teacherData/${teacherId}/subjects/${subject}/${name}`;
const arabicNumber=new Intl.NumberFormat("ar-SA-u-nu-arab",{maximumFractionDigits:1});
const ar=(value:number)=>arabicNumber.format(Number.isFinite(value)?value:0);
const pct=(value:number)=>`${ar(value)}٪`;
function gradeLabel(score:number){if(score>=17)return"ممتاز";if(score>=15)return"جيد جدًا";if(score>=12)return"جيد";if(score>0)return"يحتاج متابعة";return"لم يُرصد"}
const encouragementLevels=[
 ["ابدأ خطوتك الأولى","كل تقدم يبدأ بدرجة واحدة. ركّز على أول وحدة وابدأ اليوم.","needs-work"],
 ["بداية تحتاج همة","لديك فرصة كبيرة للتحسن؛ ابدأ بالمهمات السهلة ثم تقدّم.","needs-work"],
 ["خطوة بسيطة للأمام","بدأت تجمع الدرجات، استمر ولا تترك أي مهمة دون إنجاز.","needs-work"],
 ["التقدم بدأ يظهر","أكمل الرصد وراجع نقاط الضعف، وستلاحظ فرقًا سريعًا.","needs-work"],
 ["واصل المحاولة","أنت تتحرك في الاتجاه الصحيح، واجعل هدفك القادم خمس درجات إضافية.","needs-work"],
 ["جهدك بدأ يثمر","حافظ على الاستمرار وركّز على الحضور والمشاركة والواجبات.","needs-work"],
 ["أنت قادر على الأفضل","اقتربت من مستوى أقوى، راجع الوحدة الأقل درجة أولًا.","needs-work"],
 ["تقدم ملحوظ","هناك تحسن واضح، ومع تنظيم المراجعة ستقفز للمستوى التالي.","needs-work"],
 ["استمر ولا تتوقف","كل خمس درجات تصنع فرقًا؛ أكمل مهامك واطلب المساعدة عند الحاجة.","needs-work"],
 ["اقتربت من المنتصف","عمل جيد حتى الآن، ركّز على الاختبارات لتعزيز مجموعك.","needs-work"],
 ["نصف الطريق تقريبًا","لديك أساس جيد، والمراجعة المنتظمة سترفع نتيجتك بسرعة.","needs-work"],
 ["تقدّم جيد","أصبحت أقرب لمستوى الإتقان، لا تهمل أي درجة متاحة.","needs-work"],
 ["دخلت المستوى الجيد","أداؤك يتحسن، وحان وقت التركيز على التفاصيل الصغيرة.","good"],
 ["مستواك يتطور","واصل بهذا النسق، وحاول رفع أضعف وحدة خمس درجات.","good"],
 ["أداء جيد","أنت على الطريق الصحيح، وثباتك سيقودك إلى نتيجة أعلى.","good"],
 ["أداء جيد جدًا","بقي القليل للوصول إلى التميز؛ ركّز على الوحدة الأقل.","good"],
 ["قريب من التميز","نتيجتك قوية، والمحافظة على الانضباط سترفعك أكثر.","good"],
 ["متميز يا بطل","أداء رائع، استمر في إكمال كل بند بنفس الجدية.","excellent"],
 ["ممتاز جدًا","أنت في مستوى عالٍ، حافظ عليه وراجع التفاصيل الأخيرة.","excellent"],
 ["إبداع وتميز","نتيجة مبهرة، بقيت لمسات قليلة للوصول إلى الدرجة الكاملة.","excellent"],
 ["بطل الدرجة الكاملة","إنجاز رائع جدًا! حافظ على هذا المستوى وكن قدوة لزملائك.","excellent"],
] as const;
function encouragement(score:number){const safe=Math.max(0,Math.min(100,Math.floor(Number(score)||0)));const [title,text,tone]=encouragementLevels[Math.floor(safe/5)];return{title,text,tone}}

export default function StudentPage(){
 const[nationalId,setNationalId]=useState("");const[accessCode,setAccessCode]=useState("");const[subject,setSubject]=useState<SubjectKey>("history");const[message,setMessage]=useState("");const[loading,setLoading]=useState(false);const[student,setStudent]=useState<StudentRecord|null>(null);const[studentDocId,setStudentDocId]=useState("");const[attendanceDocs,setAttendanceDocs]=useState<AttendanceDoc[]>([]);
 const currentSubject=subjects.find(s=>s.key===subject)||subjects[0],studentsPath=tenantPath(currentSubject.teacherId,subject,"students"),attendancePath=tenantPath(currentSubject.teacherId,subject,"attendance");
 async function submit(e?:FormEvent){e?.preventDefault();const id=nationalId.replace(/\D/g,""),code=accessCode.trim().toUpperCase();setMessage("");setStudent(null);setStudentDocId("");if(!/^\d{10}$/.test(id))return setMessage("أدخل رقم هوية صحيحًا من ١٠ أرقام");if(code.length<6)return setMessage("أدخل كود الطالب الصحيح");try{setLoading(true);const snap=await getDoc(doc(db,studentsPath,id));if(!snap.exists())return setMessage(`لا توجد بيانات للطالب في مادة ${currentSubject.label}`);const data=snap.data() as StudentRecord;if(String(data.accessCode||"").toUpperCase()!==code)return setMessage("رقم الهوية أو كود الطالب غير صحيح");setNationalId(id);setAccessCode(code);setStudent(data);setStudentDocId(snap.id)}catch{setMessage("تعذر قراءة البيانات الآن. حاول مرة أخرى.")}finally{setLoading(false)}}
 useEffect(()=>{const p=new URLSearchParams(window.location.search),id=(p.get("nationalId")||"").replace(/\D/g,""),code=(p.get("code")||"").toUpperCase(),requested=p.get("subject") as SubjectKey|null;if(/^\d{10}$/.test(id))setNationalId(id);if(code)setAccessCode(code);if(requested&&subjects.some(s=>s.key===requested))setSubject(requested)},[]);
 useEffect(()=>{if(!studentDocId)return;const a=onSnapshot(doc(db,studentsPath,studentDocId),snap=>{if(snap.exists())setStudent(snap.data() as StudentRecord)}),b=onSnapshot(collection(db,attendancePath),snap=>setAttendanceDocs(snap.docs.map(d=>d.data() as AttendanceDoc)));return()=>{a();b()}},[studentDocId,studentsPath,attendancePath]);
 const unitRows=useMemo(()=>units.map(([key,label])=>{const r=student?.units?.[key]||{},attendance=Number(r.attendance||0),participation=Number(r.participation||0),homework=Number(r.homework||0),unitExam=Number(r.unitExam??r.exam1??r.exam2??0),total=Number(r.total??attendance+participation+homework+unitExam);return{key,label,attendance,participation,homework,unitExam,total,notes:r.notes||""}}),[student]);
 const research=Number(student?.research??student?.researchScore??0),unitsTotal=unitRows.reduce((s,u)=>s+u.total,0),finalTotal=Math.min(100,unitsTotal+research),motivational=encouragement(finalTotal),recordedUnits=unitRows.filter(u=>u.total>0),averageUnits=recordedUnits.length?Math.round(recordedUnits.reduce((s,u)=>s+u.total,0)/recordedUnits.length*10)/10:0,remaining=Math.max(0,100-finalTotal);
 const firstRecorded=recordedUnits[0],lastRecorded=recordedUnits.at(-1),journeyDelta=firstRecorded&&lastRecorded&&firstRecorded.key!==lastRecorded.key?lastRecorded.total-firstRecorded.total:0;
 const strongest=recordedUnits.length?[...recordedUnits].sort((a,b)=>b.total-a.total)[0]:null,weakest=recordedUnits.length?[...recordedUnits].sort((a,b)=>a.total-b.total)[0]:null;
 const attendanceSummary=useMemo(()=>{const r={present:0,absent:0,late:0,excused:0,escaped:0};attendanceDocs.forEach(d=>{const status=d.records?.[studentDocId];if(status)r[status]++});return r},[attendanceDocs,studentDocId]),recorded=Object.values(attendanceSummary).reduce((a,b)=>a+b,0),attendanceRate=recorded?Math.round(attendanceSummary.present/recorded*100):0;
 const ringStyle={"--progress":`${finalTotal*3.6}deg`} as CSSProperties;
 if(!student)return <main className="portal-login" dir="rtl"><section className="portal-login-shell"><div className="portal-login-visual"><div><span className="eyebrow">بوابة الطالب</span><h1>أستاذ لحوني التعليمية</h1><p>تابع درجاتك وحضورك في صفحة واضحة وسريعة.</p></div><div className="portal-orbit" aria-hidden="true"><div className="ring"/><div className="ring two"/><div className="book">✦</div></div><div className="portal-feature-row"><span>📊 الدرجات</span><span>📅 الحضور</span><span>🔔 التنبيهات</span></div></div><div className="portal-login-form"><Link href="/" className="portal-back">← العودة للرئيسية</Link><div className="portal-brand"><div className="portal-brand-mark">ح</div><div><strong>أستاذ لحوني</strong><small>بوابة الطالب</small></div></div><h2>تسجيل الدخول</h2><p className="lead">اختر المادة ثم أدخل بياناتك.</p><label className="portal-field">المادة</label><div className="subject-picker">{subjects.map(item=><button key={item.key} type="button" className={`subject-option ${subject===item.key?"active":""}`} onClick={()=>{setSubject(item.key);setMessage("")}}><span className="subject-icon">{item.icon}</span><span><b>{item.label}</b><small>{item.teacher}</small></span><i>{subject===item.key?"✓":""}</i></button>)}</div><form onSubmit={submit}><label className="portal-field">رقم الهوية</label><div className="portal-input"><span>🪪</span><input inputMode="numeric" value={nationalId} onChange={e=>setNationalId(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="رقم الهوية الوطنية"/></div><label className="portal-field">كود الطالب</label><div className="portal-input"><span>🔐</span><input dir="ltr" value={accessCode} onChange={e=>setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12))} placeholder="كود الطالب"/></div>{message&&<p className="portal-error">{message}</p>}<button className="portal-submit" disabled={loading}>{loading?"جارٍ التحقق...":`دخول إلى ${currentSubject.label}`}</button></form></div></section></main>;
 return <main className="student-clean" dir="rtl"><header className="student-clean-head"><div><span>{currentSubject.icon} بوابة الطالب — {currentSubject.label}</span><h1>{student.name||"الطالب"}</h1><p>{student.class||"غير محدد"} • {student.teacherName||currentSubject.teacher}</p></div><div className="student-head-actions"><button onClick={()=>window.print()}>طباعة / PDF</button><button className="ghost" onClick={()=>{setStudent(null);setStudentDocId("")}}>خروج</button></div></header>
 <section className={`student-main-summary ${motivational.tone}`}><div className="student-score-ring smart-ring" style={ringStyle}><div><strong>{ar(finalTotal)}</strong><span>من ١٠٠</span></div></div><div className="smart-summary-copy"><small>مجموعك الحالي</small><h2>{motivational.title}</h2><p>{motivational.text}</p><div className="remaining-score">{remaining===0?"🎉 حققت الدرجة الكاملة":`تبقى لك ${ar(remaining)} درجة للوصول إلى الدرجة الكاملة`}</div></div></section>
 <section className="student-journey"><div className="journey-icon">✨</div><div><small>رحلة التقدم</small><h3>{recordedUnits.length<2?"سنقارن تقدمك بعد رصد وحدتين":journeyDelta>0?`تحسّن أداؤك بمقدار ${ar(journeyDelta)} درجات` :journeyDelta<0?`انخفض آخر مستوى بمقدار ${ar(Math.abs(journeyDelta))} درجات`:"مستواك ثابت بين أول وآخر وحدة"}</h3><p>{strongest&&weakest&&strongest.key!==weakest.key?`أقوى أداء في ${strongest.label}، وفرصتك الأسرع للتحسن تبدأ من ${weakest.label}.`:"أكمل رصد الوحدات ليظهر تحليل أدق لمسارك."}</p></div></section>
 {Number(student.parentCounselorNoticeCount||0)>0&&<section className="student-notice"><b>🔔 تنبيه من المعلم</b><p>{student.parentCounselorLastNotice?.message||"يوجد تنبيه جديد من المعلم."}</p></section>}
 <section className="student-mini-stats"><article><span>الحضور</span><strong>{pct(attendanceRate)}</strong></article><article><span>متوسط الوحدات</span><strong>{ar(averageUnits)}/١٩</strong></article><article><span>البحث</span><strong>{ar(research)}/٥</strong></article><article><span>الوحدات المرصودة</span><strong>{ar(recordedUnits.length)}/٥</strong></article></section>
 <section className="student-units-table"><div className="student-section-title"><div><h2>درجات الوحدات</h2><p>تحليل واضح لكل عنصر من عناصر الدرجة.</p></div></div><div className="student-table-scroll"><table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th><th>التقدير</th></tr></thead><tbody>{unitRows.map(u=><tr key={u.key}><td><b>{u.label}</b></td><td>{ar(u.attendance)}/٣</td><td>{ar(u.participation)}/٤</td><td>{ar(u.homework)}/٢</td><td>{ar(u.unitExam)}/١٠</td><td><strong>{ar(u.total)}/١٩</strong></td><td><span className={`grade-pill ${u.total>=15?"good":u.total>0?"warn":"empty"}`}>{gradeLabel(u.total)}</span></td></tr>)}</tbody></table></div></section>
 <section className="student-bottom-grid"><article><h3>الحضور والانضباط</h3><div className="student-attendance-row"><span>غياب <b>{ar(attendanceSummary.absent)}</b></span><span>تأخر <b>{ar(attendanceSummary.late)}</b></span><span>استئذان <b>{ar(attendanceSummary.excused)}</b></span><span className="escaped">مغادرة دون إذن <b>{ar(attendanceSummary.escaped)}</b></span></div></article><article><h3>ملاحظة المعلم</h3><p>{student.teacherNote||"لا توجد ملاحظة مسجلة حاليًا."}</p></article></section>
 </main>;
}
