"use client";

import { useEffect, useMemo, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./notes-v10.css";

type Student={id:string;code:string;name:string;className:string;grade?:number};
type Note={id?:string;type?:string;label?:string;message?:string;createdAt?:string;teacherName?:string;subject?:string};
type NoteRow={studentCode:string;studentName:string;className:string;notes:Note[]};

type Preset={group:string;type:string;label:string;message:string;tone:"good"|"academic"|"care"|"contact"};
const presets:Preset[]=[
  {group:"تميز",type:"positive",label:"تميز ومشاركة فعالة",message:"أظهر الطالب تميزًا ومشاركة فعالة في الحصة، ويستحق الاستمرار على هذا المستوى.",tone:"good"},
  {group:"تحسن",type:"improvement",label:"تحسن ملحوظ",message:"يوجد تحسن ملحوظ في مستوى الطالب واستجابته للمتابعة، ونأمل الاستمرار على هذا التقدم.",tone:"good"},
  {group:"تحصيل",type:"academic",label:"يحتاج مراجعة المهارة",message:"يحتاج الطالب إلى مراجعة المهارة المستهدفة والتدرب عليها بصورة منتظمة.",tone:"academic"},
  {group:"إتقان",type:"mastery",label:"عدم إتقان",message:"لم يتحقق الإتقان المطلوب حتى الآن، ويُنصح بمتابعة الخطة العلاجية والتدريب الإضافي.",tone:"academic"},
  {group:"واجبات",type:"homework",label:"متابعة الواجبات",message:"يحتاج الطالب إلى مزيد من الانتظام في أداء الواجبات وتسليمها في الوقت المحدد.",tone:"care"},
  {group:"مشاركة",type:"participation",label:"ضعف المشاركة",message:"المشاركة الصفية أقل من المتوقع، ويُنصح بتشجيع الطالب على التفاعل وطرح الأسئلة.",tone:"care"},
  {group:"حضور",type:"attendance",label:"أثر الغياب أو التأخر",message:"أثر الغياب أو التأخر على متابعة الطالب للمحتوى، ويحتاج إلى تعويض ما فاته.",tone:"care"},
  {group:"دعم",type:"support",label:"خطة علاجية",message:"يُنصح بإدراج الطالب ضمن متابعة علاجية قصيرة مع تحديد المهارة وقياس التحسن.",tone:"academic"},
  {group:"إثراء",type:"enrichment",label:"مناسب للإثراء",message:"مستوى الطالب يسمح بتقديم نشاط إثرائي وتحديات إضافية لتنمية مهاراته.",tone:"good"},
  {group:"تواصل",type:"parent",label:"التواصل مع ولي الأمر",message:"يُنصح بمتابعة الملاحظة مع ولي الأمر لتعزيز التحسن واستمرار المتابعة المنزلية.",tone:"contact"},
];

function arabicDate(value?:string){if(!value)return"";const date=new Date(value);if(Number.isNaN(date.getTime()))return"";return new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Riyadh"}).format(date);}

export default function TeacherNotesPage(){
  const session=useTeacherClient();
  const [students,setStudents]=useState<Student[]>([]);
  const [rows,setRows]=useState<NoteRow[]>([]);
  const [className,setClassName]=useState("");
  const [studentCode,setStudentCode]=useState("");
  const [selectedPreset,setSelectedPreset]=useState(0);
  const [custom,setCustom]=useState("");
  const [search,setSearch]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const subjectId=String(session?.subjectKey||"");
  const grade=session?.activeGrade||null;

  async function load(){
    if(!subjectId)return;
    const params=new URLSearchParams({subjectId});if(grade)params.set("grade",String(grade));
    const [studentsResponse,notesResponse]=await Promise.all([fetch(`/api/teacher/students?${params}`,{cache:"no-store"}),fetch(`/api/teacher/notes?subjectId=${encodeURIComponent(subjectId)}`,{cache:"no-store"})]);
    const studentData=await studentsResponse.json().catch(()=>({}));const notesData=await notesResponse.json().catch(()=>({}));
    if(studentsResponse.ok){
      const list=(Array.isArray(studentData.students)?studentData.students:[]).map((student:Record<string,unknown>)=>({id:String(student.id||student.code||""),code:String(student.code||student.id||""),name:String(student.name||""),className:String(student.className||student.class||""),grade:Number(student.grade||0)})).filter((student:Student)=>student.code&&student.name);
      setStudents(list);setClassName(current=>current&&list.some((s:Student)=>s.className===current)?current:(list[0]?.className||""));
    }
    if(notesResponse.ok)setRows(Array.isArray(notesData.rows)?notesData.rows:[]);
  }
  useEffect(()=>{void load();},[subjectId,grade]);

  const classes=useMemo(()=>[...new Set(students.map(student=>student.className).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
  const classCounts=useMemo(()=>Object.fromEntries(classes.map(name=>[name,students.filter(student=>student.className===name).length])),[classes,students]);
  const classStudents=useMemo(()=>students.filter(student=>student.className===className&&(!search.trim()||student.name.includes(search.trim())||student.code.includes(search.trim()))).sort((a,b)=>a.name.localeCompare(b.name,"ar")),[students,className,search]);
  const selectedStudent=students.find(student=>student.code===studentCode)||null;
  const selectedRow=rows.find(row=>row.studentCode===studentCode)||null;
  const preset=presets[selectedPreset];
  const noteText=custom.trim()||preset.message;
  const noteCount=(code:string)=>rows.find(row=>row.studentCode===code)?.notes?.length||0;

  useEffect(()=>{if(!classStudents.some(student=>student.code===studentCode))setStudentCode(classStudents[0]?.code||"");},[className,classStudents,studentCode]);

  async function save(){
    if(!selectedStudent||!noteText.trim())return setMessage("اختر الطالب واكتب الملاحظة.");setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/teacher/notes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subjectId,subject:session?.subject||subjectId,studentCode:selectedStudent.code,type:custom.trim()?"custom":preset.type,label:custom.trim()?"ملاحظة مخصصة":preset.label,message:noteText})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر حفظ الملاحظة");setCustom("");setMessage("تم حفظ الملاحظة وستظهر للطالب وولي الأمر.");await load();
    }catch(error){setMessage(error instanceof Error?error.message:"تعذر حفظ الملاحظة");}finally{setBusy(false);}
  }
  async function remove(noteId?:string){
    if(!noteId||!selectedStudent)return;if(!confirm("حذف هذه الملاحظة؟"))return;setBusy(true);
    try{const response=await fetch("/api/teacher/notes",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({subjectId,studentCode:selectedStudent.code,noteId})});if(!response.ok)throw new Error();await load();setMessage("تم حذف الملاحظة.");}catch{setMessage("تعذر حذف الملاحظة.");}finally{setBusy(false);}
  }

  return <main className="notes-v10" dir="rtl">
    {message?<div className="nv10-message">{message}</div>:null}
    <section className="nv10-workspace">
      <aside className="nv10-classes">
        <header><small>الخطوة ١</small><h2>اختر الفصل</h2></header>
        <div>{classes.map(name=><button type="button" key={name} className={name===className?"active":""} onClick={()=>{setClassName(name);setSearch("");}}><b>{name}</b><span>{classCounts[name]||0} طالب</span></button>)}</div>
        {!classes.length?<p>لا توجد فصول مسندة.</p>:null}
      </aside>

      <section className="nv10-students">
        <header><div><small>الخطوة ٢</small><h2>اختر الطالب</h2></div><span>{classStudents.length}</span></header>
        <label><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="ابحث بالاسم أو الكود"/><span>بحث</span></label>
        <div className="nv10-student-list">{classStudents.map((student,index)=><button type="button" key={student.code} className={student.code===studentCode?"active":""} onClick={()=>setStudentCode(student.code)}><i>{index+1}</i><span><b>{student.name}</b><small>{student.code}</small></span><em>{noteCount(student.code)?`${noteCount(student.code)} ملاحظة`:"بدون ملاحظات"}</em></button>)}{!classStudents.length?<p>لا توجد نتائج في هذا الفصل.</p>:null}</div>
      </section>

      <section className="nv10-compose">
        <header className="nv10-compose-head"><div><small>الخطوة ٣ • سجل الطالب</small><h2>{selectedStudent?.name||"اختر طالبًا"}</h2><p>{selectedStudent?`${selectedStudent.className} • ${session?.subject||"المادة"}`:"ستظهر أدوات الملاحظة بعد اختيار الطالب."}</p></div><span>{selectedRow?.notes?.length||0}<small>ملاحظة</small></span></header>

        {selectedStudent?<>
          <section className="nv10-smart-note"><span>AI</span><div><small>مساعدة في الصياغة</small><b>اختر سبب الملاحظة أولًا</b><p>يمكنك استخدام الصياغة المقترحة كما هي أو تعديلها. لن يتم إرسال شيء حتى تضغط حفظ.</p></div></section>
          <div className="nv10-presets">{presets.map((item,index)=><button type="button" key={`${item.type}-${item.label}`} data-tone={item.tone} className={selectedPreset===index&&!custom.trim()?"active":""} onClick={()=>{setSelectedPreset(index);setCustom("");}}><small>{item.group}</small><b>{item.label}</b></button>)}</div>
          <label className="nv10-editor"><span>نص الملاحظة كما سيظهر للطالب وولي الأمر</span><textarea value={custom} onChange={event=>setCustom(event.target.value)} placeholder={preset.message}/><small>{custom.trim()?"صياغة مخصصة من المعلم":`الصياغة المقترحة: ${preset.message}`}</small></label>
          <section className="nv10-preview"><small>معاينة قبل الحفظ</small><b>{selectedStudent.name}</b><p>{noteText}</p></section>
          <button className="nv10-save" type="button" disabled={busy} onClick={()=>void save()}>{busy?"جارٍ الحفظ…":"حفظ وإظهار الملاحظة للطالب وولي الأمر"}</button>

          <details className="nv10-history" open={Boolean(selectedRow?.notes?.length)}><summary>سجل الملاحظات السابقة <span>{selectedRow?.notes?.length||0}</span></summary><div>{selectedRow?.notes?.map(note=><article key={note.id||`${note.createdAt}-${note.message}`}><header><div><b>{note.label||"ملاحظة"}</b><small>{arabicDate(note.createdAt)}</small></div><button type="button" disabled={busy} onClick={()=>void remove(note.id)}>حذف</button></header><p>{note.message}</p></article>)}{!selectedRow?.notes?.length?<p className="nv10-no-history">لا توجد ملاحظات سابقة لهذا الطالب.</p>:null}</div></details>
        </>:<div className="nv10-empty"><b>اختر طالبًا من القائمة</b><span>ستظهر هنا الملاحظات المقترحة وسجل الطالب.</span></div>}
      </section>
    </section>
  </main>;
}
