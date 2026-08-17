"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import "./student.css";
import "./identity.css";
import "./portal-login.css";

type SubjectKey = "history" | "critical-thinking";
type AttendanceStatus = "present" | "absent" | "late" | "excused" | "escaped";
type UnitRecord = { total?:number; attendance?:number; participation?:number; homework?:number; unitExam?:number; exam1?:number; exam2?:number; notes?:string };
type ParentNotice = { message?:string; createdAt?:string };
type StudentRecord = { name?:string; class?:string; nationalId?:string; accessCode?:string; teacherName?:string; research?:number; researchScore?:number; teacherNote?:string; parentCounselorNoticeCount?:number; parentCounselorLastNotice?:ParentNotice; units?:Record<string,UnitRecord> };
type AttendanceDoc = { records?:Record<string,AttendanceStatus> };

const subjects:{key:SubjectKey;label:string;teacher:string;teacherId:string;icon:string}[]=[
 {key:"history",label:"التاريخ",teacher:"الأستاذ حسن علي الطويل",teacherId:"hasan-history",icon:"🏛️"},
 {key:"critical-thinking",label:"التفكير الناقد",teacher:"الأستاذ عبد الله الرويشد",teacherId:"abdullah-critical-thinking",icon:"🧠"},
];
const units=[["unit1","الوحدة الأولى"],["unit2","الوحدة الثانية"],["unit3","الوحدة الثالثة"],["unit4","الوحدة الرابعة"],["unit5","الوحدة الخامسة"]] as const;
const tenantPath=(teacherId:string,subject:SubjectKey,name:string)=>`teacherData/${teacherId}/subjects/${subject}/${name}`;
function gradeLabel(score:number){if(score>=17)return"ممتاز";if(score>=15)return"جيد جدًا";if(score>=12)return"جيد";if(score>0)return"يحتاج متابعة";return"لم يُرصد"}
const encouragementLevels=[
 {title:"ابدأ خطوتك الأولى",text:"كل تقدم يبدأ بدرجة واحدة. ركّز على أول وحدة وابدأ اليوم.",tone:"needs-work"},
 {title:"بداية تحتاج همة",text:"لديك فرصة كبيرة للتحسن؛ ابدأ بالمهمات السهلة ثم تقدّم.",tone:"needs-work"},
 {title:"خطوة بسيطة للأمام",text:"بدأت تجمع الدرجات، استمر ولا تترك أي مهمة دون إنجاز.",tone:"needs-work"},
 {title:"التقدم بدأ يظهر",text:"أكمل الرصد وراجع نقاط الضعف، وستلاحظ فرقًا سريعًا.",tone:"needs-work"},
 {title:"واصل المحاولة",text:"أنت تتحرك في الاتجاه الصحيح، واجعل هدفك القادم خمس درجات إضافية.",tone:"needs-work"},
 {title:"جهدك بدأ يثمر",text:"حافظ على الاستمرار وركّز على الحضور والمشاركة والواجبات.",tone:"needs-work"},
 {title:"أنت قادر على الأفضل",text:"اقتربت من مستوى أقوى، راجع الوحدة الأقل درجة أولًا.",tone:"needs-work"},
 {title:"تقدم ملحوظ",text:"هناك تحسن واضح، ومع تنظيم المراجعة ستقفز للمستوى التالي.",tone:"needs-work"},
 {title:"استمر ولا تتوقف",text:"كل خمس درجات تصنع فرقًا؛ أكمل مهامك واطلب المساعدة عند الحاجة.",tone:"needs-work"},
 {title:"اقتربت من المنتصف",text:"عمل جيد حتى الآن، ركّز على الاختبارات لتعزيز مجموعك.",tone:"needs-work"},
 {title:"نصف الطريق تقريبًا",text:"لديك أساس جيد، والمراجعة المنتظمة سترفع نتيجتك بسرعة.",tone:"needs-work"},
 {title:"تقدّم جيد",text:"أصبحت أقرب لمستوى الإتقان، لا تهمل أي درجة متاحة.",tone:"needs-work"},
 {title:"دخلت المستوى الجيد",text:"أداؤك يتحسن، وحان وقت التركيز على التفاصيل الصغيرة.",tone:"good"},
 {title:"مستواك يتطور",text:"واصل بهذا النسق، وحاول رفع أضعف وحدة خمس درجات.",tone:"good"},
 {title:"أداء جيد",text:"أنت على الطريق الصحيح، وثباتك سيقودك إلى نتيجة أعلى.",tone:"good"},
 {title:"أداء جيد جدًا",text:"بقي القليل للوصول إلى التميز؛ ركّز على الوحدة الأقل.",tone:"good"},
 {title:"قريب من التميز",text:"نتيجتك قوية، والمحافظة على الانضباط سترفعك أكثر.",tone:"good"},
 {title:"متميز يا بطل",text:"أداء رائع، استمر في إكمال كل بند بنفس الجدية.",tone:"excellent"},
 {title:"ممتاز جدًا",text:"أنت في مستوى عالٍ، حافظ عليه وراجع التفاصيل الأخيرة.",tone:"excellent"},
 {title:"إبداع وتميز",text:"نتيجة مبهرة، بقيت لمسات قليلة للوصول إلى الدرجة الكاملة.",tone:"excellent"},
 {title:"بطل الدرجة الكاملة",text:"إنجاز رائع جدًا! حافظ على هذا المستوى وكن قدوة لزملائك.",tone:"excellent"},
] as const;
function encouragement(score:number){const safe=Math.max(0,Math.min(100,Math.floor(Number(score)||0)));return encouragementLevels[Math.floor(safe/5)]}

export default function StudentPage(){
 const[nationalId,setNationalId]=useState("");const[accessCode,setAccessCode]=useState("");const[subject,setSubject]=useState<SubjectKey>("history");const[message,setMessage]=useState("");const[loading,setLoading]=useState(false);const[student,setStudent]=useState<StudentRecord|null>(null);const[studentDocId,setStudentDocId]=useState("");const[attendanceDocs,setAttendanceDocs]=useState<AttendanceDoc[]>([]);
 const currentSubject=subjects.find(s=>s.key===subject)||subjects[0],studentsPath=tenantPath(currentSubject.teacherId,subject,"students"),attendancePath=tenantPath(currentSubject.teacherId,subject,"attendance");
 async function submit(e?:FormEvent){e?.preventDefault();const id=nationalId.replace(/\D/g,""),code=accessCode.trim().toUpperCase();setMessage("");setStudent(null);setStudentDocId("");if(!/^\d{10}$/.test(id))return setMessage("أدخل رقم هوية صحيحًا من 10 أرقام");if(code.length<6)return setMessage("أدخل كود الطالب الصحيح");try{setLoading(true);const snap=await getDoc(doc(db,studentsPath,id));if(!snap.exists())return setMessage(`لا توجد بيانات للطالب في مادة ${currentSubject.label}`);const data=snap.data() as StudentRecord;if(String(data.accessCode||"").toUpperCase()!==code)return setMessage("رقم الهوية أو كود الطالب غير صحيح");setNationalId(id);setAccessCode(code);setStudent(data);setStudentDocId(snap.id)}catch{setMessage("تعذر قراءة البيانات الآن. حاول مرة أخرى.")}finally{setLoading(false)}}
 useEffect(()=>{const p=new URLSearchParams(window.location.search),id=(p.get("nationalId")||"").replace(/\D/g,""),code=(p.get("code")||"").toUpperCase(),requested=p.get("subject") as SubjectKey|null;if(/^\d{10}$/.test(id))setNationalId(id);if(code)setAccessCode(code);if(requested&&subjects.some(s=>s.key===requested))setSubject(requested)},[]);
 useEffect(()=>{if(!studentDocId)return;const a=onSnapshot(doc(db,studentsPath,studentDocId),snap=>{if(snap.exists())setStudent(snap.data() as StudentRecord)}),b=onSnapshot(collection(db,attendancePath),snap=>setAttendanceDocs(snap.docs.map(d=>d.data() as AttendanceDoc)));return()=>{a();b()}},[studentDocId,studentsPath,attendancePath]);
 const unitRows=useMemo(()=>units.map(([key,label])=>{const r=student?.units?.[key]||{},attendance=Number(r.attendance||0),participation=Number(r.participation||0),homework=Number(r.homework||0),unitExam=Number(r.unitExam??r.exam1??r.exam2??0),total=Number(r.total??attendance+participation+homework+unitExam);return{key,label,attendance,participation,homework,unitExam,total,notes:r.notes||""}}),[student]);
 const research=Number(student?.research??student?.researchScore??0),unitsTotal=unitRows.reduce((s,u)=>s+u.total,0),finalTotal=unitsTotal+research,motivational=encouragement(finalTotal),recordedUnits=unitRows.filter(u=>u.total>0),averageUnits=recordedUnits.length?Math.round(recordedUnits.reduce((s,u)=>s+u.total,0)/recordedUnits.length*10)/10:0;
 const attendanceSummary=useMemo(()=>{const r={present:0,absent:0,late:0,excused:0,escaped:0};attendanceDocs.forEach(d=>{const status=d.records?.[studentDocId];if(status)r[status]++});return r},[attendanceDocs,studentDocId]),recorded=Object.values(attendanceSummary).reduce((a,b)=>a+b,0),attendanceRate=recorded?Math.round(attendanceSummary.present/recorded*100):0;
 if(!student)return <main className="portal-login" dir="rtl"><section className="portal-login-shell"><div className="portal-login-visual"><div><span className="eyebrow">بوابة الطالب</span><h1>أستاذ لحوني التعليمية</h1><p>تابع درجاتك وحضورك في صفحة واضحة وسريعة.</p></div><div className="portal-orbit" aria-hidden="true"><div className="ring"/><div className="ring two"/><div className="book">✦</div></div><div className="portal-feature-row"><span>📊 الدرجات</span><span>📅 الحضور</span><span>🔔 التنبيهات</span></div></div><div className="portal-login-form"><Link href="/" className="portal-back">← العودة للرئيسية</Link><div className="portal-brand"><div className="portal-brand-mark">ح</div><div><strong>أستاذ لحوني</strong><small>بوابة الطالب</small></div></div><h2>تسجيل الدخول</h2><p className="lead">اختر المادة ثم أدخل بياناتك.</p><label className="portal-field">المادة</label><div className="subject-picker">{subjects.map(item=><button key={item.key} type="button" className={`subject-option ${subject===item.key?"active":""}`} onClick={()=>{setSubject(item.key);setMessage("")}}><span className="subject-icon">{item.icon}</span><span><b>{item.label}</b><small>{item.teacher}</small></span><i>{subject===item.key?"✓":""}</i></button>)}</div><form onSubmit={submit}><label className="portal-field">رقم الهوية</label><div className="portal-input"><span>🪪</span><input inputMode="numeric" value={nationalId} onChange={e=>setNationalId(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="رقم الهوية الوطنية"/></div><label className="portal-field">كود الطالب</label><div className="portal-input"><span>🔐</span><input dir="ltr" value={accessCode} onChange={e=>setAccessCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12))} placeholder="كود الطالب"/></div>{message&&<p className="portal-error">{message}</p>}<button className="portal-submit" disabled={loading}>{loading?"جارٍ التحقق...":`دخول إلى ${currentSubject.label}`}</button></form></div></section></main>;
 return <main className="student-clean" dir="rtl"><header className="student-clean-head"><div><span>{currentSubject.icon} بوابة الطالب — {currentSubject.label}</span><h1>{student.name||"الطالب"}</h1><p>{student.class||"غير محدد"} • {student.teacherName||currentSubject.teacher}</p></div><div className="student-head-actions"><button onClick={()=>window.print()}>طباعة / PDF</button><button className="ghost" onClick={()=>{setStudent(null);setStudentDocId("")}}>خروج</button></div></header>
 <section className="student-main-summary"><div className="student-score-ring"><strong>{finalTotal}</strong><span>من ١٠٠</span></div><div><small>مجموعك الحالي</small><h2>{motivational.title}</h2><p>{motivational.text}</p></div></section>
 {Number(student.parentCounselorNoticeCount||0)>0&&<section className="student-notice"><b>🔔 تنبيه من المعلم</b><p>{student.parentCounselorLastNotice?.message||"يوجد تنبيه جديد من المعلم."}</p></section>}
 <section className="student-mini-stats"><article><span>الحضور</span><strong>{attendanceRate}%</strong></article><article><span>متوسط الوحدات</span><strong>{averageUnits}/١٩</strong></article><article><span>البحث</span><strong>{research}/٥</strong></article><article><span>الوحدات المرصودة</span><strong>{recordedUnits.length}/٥</strong></article></section>
 <section className="student-units-table"><div className="student-section-title"><div><h2>درجات الوحدات</h2><p>عرض مختصر بدون تكرار التفاصيل.</p></div></div><div className="student-table-scroll"><table><thead><tr><th>الوحدة</th><th>الحضور</th><th>المشاركة</th><th>الواجبات</th><th>الاختبار</th><th>المجموع</th><th>التقدير</th></tr></thead><tbody>{unitRows.map(u=><tr key={u.key}><td><b>{u.label}</b></td><td>{u.attendance}/٣</td><td>{u.participation}/٤</td><td>{u.homework}/٢</td><td>{u.unitExam}/١٠</td><td><strong>{u.total}/١٩</strong></td><td><span className={`grade-pill ${u.total>=15?"good":u.total>0?"warn":"empty"}`}>{gradeLabel(u.total)}</span></td></tr>)}</tbody></table></div></section>
 <section className="student-bottom-grid"><article><h3>الحضور والانضباط</h3><div className="student-attendance-row"><span>غياب <b>{attendanceSummary.absent}</b></span><span>تأخر <b>{attendanceSummary.late}</b></span><span>استئذان <b>{attendanceSummary.excused}</b></span><span className="escaped">مغادرة دون إذن <b>{attendanceSummary.escaped}</b></span></div></article><article><h3>ملاحظة المعلم</h3><p>{student.teacherNote||"لا توجد ملاحظة مسجلة حاليًا."}</p></article></section>
 </main>;
}
