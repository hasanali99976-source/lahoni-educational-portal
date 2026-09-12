"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { usePathname } from "next/navigation";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import ReferralManagerV510 from "./referral-manager-v510";

type Student = { id:string; code?:string; name?:string; class?:string; className?:string };
type ReferralType = "achievement"|"behavior"|"attendance"|"interaction"|"homework"|"wellbeing"|"other";

const counselorPhone = "966598353651";
const referralTypes: Array<{value:ReferralType;label:string;hint:string;reason:string}> = [
  {value:"achievement",label:"التحصيل والإتقان",hint:"ضعف التحصيل أو عدم إتقان المهارات",reason:"انخفاض مستوى التحصيل الدراسي"},
  {value:"behavior",label:"سلوك وانضباط",hint:"سلوك متكرر يحتاج متابعة تربوية",reason:"حالة سلوكية تحتاج متابعة من المرشد الطلابي"},
  {value:"attendance",label:"غياب وتأخر",hint:"تكرار الغياب أو التأخر أو الاستئذان",reason:"تكرار الغياب أو التأخر ويحتاج متابعة"},
  {value:"interaction",label:"ضعف التفاعل",hint:"ضعف المشاركة أو الانعزال داخل الحصة",reason:"ضعف التفاعل والمشاركة الصفية"},
  {value:"homework",label:"واجبات ومهام",hint:"تكرار عدم إنجاز الواجبات أو المهام",reason:"تكرار عدم إنجاز الواجبات والمهام المطلوبة"},
  {value:"wellbeing",label:"حالة تحتاج متابعة",hint:"ملاحظة تربوية أو اجتماعية تحتاج تدخل المرشد",reason:"حالة تربوية تحتاج متابعة من المرشد الطلابي"},
  {value:"other",label:"سبب آخر",hint:"إحالة مخصصة لأي سبب آخر",reason:""},
];

export default function FollowUpEnhancerCurrent(){
  const pathname=usePathname();
  const session=useTeacherClient();
  const [open,setOpen]=useState(false);
  const [students,setStudents]=useState<Student[]>([]);
  const [loading,setLoading]=useState(false);
  const [selectedClass,setSelectedClass]=useState("");
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const [type,setType]=useState<ReferralType>("achievement");
  const [reason,setReason]=useState(referralTypes[0].reason);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const active=pathname==="/teacher/follow-up";

  useEffect(()=>{
    if(!active||!session.subjectKey)return;
    const controller=new AbortController();
    const params=new URLSearchParams({subjectId:String(session.subjectKey)});
    if(session.activeGrade)params.set("grade",String(session.activeGrade));
    setLoading(true);
    fetch(`/api/teacher/students?${params}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>response.ok?response.json():Promise.reject(new Error("تعذر تحميل الطلاب")))
      .then(data=>setStudents(Array.isArray(data.students)?data.students:[]))
      .catch(error=>{if((error as Error).name!=="AbortError")setMessage("تعذر تحميل قائمة الطلاب للإحالة.");})
      .finally(()=>setLoading(false));
    return()=>controller.abort();
  },[active,session.subjectKey,session.activeGrade]);

  const classes=useMemo(()=>[...new Set(students.map(student=>String(student.className||student.class||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
  const visible=useMemo(()=>students.filter(student=>!selectedClass||String(student.className||student.class||"").trim()===selectedClass),[students,selectedClass]);
  const selected=visible.filter(student=>selectedIds.includes(String(student.id||student.code||"")));
  const selectedType=referralTypes.find(item=>item.value===type)||referralTypes[0];

  function startReferral(){
    setSelectedClass(classes[0]||"");setSelectedIds([]);setType("achievement");setReason(referralTypes[0].reason);setMessage("");setOpen(true);
  }
  function changeType(next:ReferralType){setType(next);setReason(referralTypes.find(item=>item.value===next)?.reason||"");}

  async function save(){
    if(!session.teacherId||!session.subjectKey)return;
    if(!selected.length)return setMessage("حدد طالبًا واحدًا على الأقل.");
    if(!reason.trim())return setMessage("اكتب سبب الإحالة.");
    setSaving(true);setMessage("");
    const now=new Date().toISOString();
    const path=tenantCollection(String(session.teacherId),session.subjectKey as never,"counselorReferrals");
    try{
      await Promise.all(selected.map(student=>setDoc(doc(db,path,crypto.randomUUID()),{
        studentId:String(student.id||student.code||""),studentName:student.name||"",className:student.className||student.class||"",reason:reason.trim(),
        referralType:type,referralTypeLabel:selectedType.label,status:"جديدة",teacherId:session.teacherId,teacherName:session.teacherName||"المعلم",
        subjectId:session.subjectKey,subject:session.subject||"المادة",explicitTeacherAction:true,createdAt:now,
      })));
      const text=`السلام عليكم،\nإحالة للمرشد الطلابي\nالمادة: ${session.subject||"المادة"}\nالنوع: ${selectedType.label}\nالسبب: ${reason.trim()}\n\n${selected.map((student,index)=>`${index+1}. ${student.name||"—"} — ${student.className||student.class||"—"}`).join("\n")}\n\nالمعلم: ${session.teacherName||"المعلم"}`;
      window.open(`https://wa.me/${counselorPhone}?text=${encodeURIComponent(text)}`,"_blank");
      setOpen(false);setSelectedIds([]);setMessage(`تم تسجيل ${selected.length} إحالة في سجل المرشد.`);
    }catch{setMessage("تعذر تسجيل الإحالة الآن.");}finally{setSaving(false);}
  }

  if(!active)return null;
  return <section className="follow-up-enhancer-current" dir="rtl">
    <div className="fue-toolbar">
      <div><small>إجراءات المتابعة</small><strong>إحالات المرشد الطلابي</strong><p>التحصيل، السلوك، الغياب، التفاعل، الواجبات وأسباب أخرى — كلها في مكان واحد.</p></div>
      <button type="button" onClick={startReferral}>+ إحالة جديدة</button>
    </div>
    {message?<p className="fue-message">{message}</p>:null}
    <ReferralManagerV510 />

    {open?<div className="fue-modal" onClick={()=>setOpen(false)}><section className="fue-modal-card" onClick={event=>event.stopPropagation()}>
      <header><div><small>إحالة جديدة</small><h3>اختر سبب الإحالة والطلاب</h3></div><button type="button" onClick={()=>setOpen(false)}>×</button></header>
      <div className="fue-types">{referralTypes.map(item=><button type="button" key={item.value} className={type===item.value?"active":""} onClick={()=>changeType(item.value)}><b>{item.label}</b><small>{item.hint}</small></button>)}</div>
      <div className="fue-fields"><label><span>الفصل</span><select value={selectedClass} onChange={event=>{setSelectedClass(event.target.value);setSelectedIds([]);}}><option value="">جميع الفصول</option>{classes.map(name=><option key={name}>{name}</option>)}</select></label><label className="reason"><span>سبب الإحالة</span><textarea value={reason} onChange={event=>setReason(event.target.value)} placeholder="اكتب سبب الإحالة بوضوح"/></label></div>
      <div className="fue-students"><header><b>الطلاب</b><small>{loading?"جارٍ التحميل…":`${visible.length} طالب`}</small></header><div>{visible.map(student=>{const id=String(student.id||student.code||"");return <label key={id} className={selectedIds.includes(id)?"selected":""}><input type="checkbox" checked={selectedIds.includes(id)} onChange={event=>setSelectedIds(current=>event.target.checked?[...new Set([...current,id])]:current.filter(item=>item!==id))}/><span><b>{student.name||"—"}</b><small>{student.className||student.class||"—"}</small></span></label>})}</div></div>
      <footer><span>المحدد: <b>{selected.length}</b></span><div><button type="button" onClick={()=>setOpen(false)}>إلغاء</button><button type="button" className="primary" disabled={saving||!selected.length} onClick={()=>void save()}>{saving?"جارٍ التسجيل…":"تسجيل وإرسال الإحالة"}</button></div></footer>
    </section></div>:null}
  </section>;
}
