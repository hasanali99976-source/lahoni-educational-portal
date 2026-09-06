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

function arabicDate(value?:string){
  if(!value)return"";
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return"";
  return new Intl.DateTimeFormat("ar-SA",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Riyadh"}).format(date);
}

function noteTime(note:Note){
  const time=note.createdAt?new Date(note.createdAt).getTime():0;
  return Number.isFinite(time)?time:0;
}

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
    const params=new URLSearchParams({subjectId});
    if(grade)params.set("grade",String(grade));
    const [studentsResponse,notesResponse]=await Promise.all([
      fetch(`/api/teacher/students?${params}`,{cache:"no-store"}),
      fetch(`/api/teacher/notes?subjectId=${encodeURIComponent(subjectId)}`,{cache:"no-store"}),
    ]);
    const studentData=await studentsResponse.json().catch(()=>({}));
    const notesData=await notesResponse.json().catch(()=>({}));
    if(studentsResponse.ok){
      const list=(Array.isArray(studentData.students)?studentData.students:[])
        .map((student:Record<string,unknown>)=>({
          id:String(student.id||student.code||""),
          code:String(student.code||student.id||""),
          name:String(student.name||""),
          className:String(student.className||student.class||""),
          grade:Number(student.grade||0),
        }))
        .filter((student:Student)=>student.code&&student.name);
      setStudents(list);
      setClassName(current=>current&&list.some((student:Student)=>student.className===current)?current:(list[0]?.className||""));
    }
    if(notesResponse.ok)setRows(Array.isArray(notesData.rows)?notesData.rows:[]);
  }

  useEffect(()=>{void load();},[subjectId,grade]);

  const classes=useMemo(()=>[...new Set(students.map(student=>student.className).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true})),[students]);
  const classCounts=useMemo(()=>Object.fromEntries(classes.map(name=>[name,students.filter(student=>student.className===name).length])),[classes,students]);
  const studentsInClass=useMemo(()=>students.filter(student=>student.className===className).sort((a,b)=>a.name.localeCompare(b.name,"ar")),[students,className]);
  const visibleStudents=useMemo(()=>{
    const query=search.trim();
    if(!query)return studentsInClass;
    return studentsInClass.filter(student=>student.name.includes(query)||student.code.includes(query));
  },[studentsInClass,search]);
  const selectedStudent=students.find(student=>student.code===studentCode)||null;
  const selectedRow=rows.find(row=>row.studentCode===studentCode)||null;
  const selectedNotes=useMemo(()=>[...(selectedRow?.notes||[])].sort((a,b)=>noteTime(b)-noteTime(a)),[selectedRow]);
  const preset=presets[selectedPreset];
  const noteText=custom.trim()||preset.message;
  const noteCount=(code:string)=>rows.find(row=>row.studentCode===code)?.notes?.length||0;
  const classNotes=useMemo(()=>rows.filter(row=>row.className===className).reduce((sum,row)=>sum+(row.notes?.length||0),0),[rows,className]);
  const classFollowed=useMemo(()=>studentsInClass.filter(student=>noteCount(student.code)>0).length,[studentsInClass,rows]);

  useEffect(()=>{
    if(!studentsInClass.some(student=>student.code===studentCode))setStudentCode(studentsInClass[0]?.code||"");
  },[studentsInClass,studentCode]);

  async function save(){
    if(!selectedStudent||!noteText.trim())return setMessage("اختر الطالب واكتب الملاحظة.");
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/teacher/notes",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          subjectId,
          subject:session?.subject||subjectId,
          studentCode:selectedStudent.code,
          type:custom.trim()?"custom":preset.type,
          label:custom.trim()?"ملاحظة مخصصة":preset.label,
          message:noteText,
        }),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||"تعذر حفظ الملاحظة");
      setCustom("");
      setMessage("تم حفظ الملاحظة وستظهر للطالب وولي الأمر.");
      await load();
    }catch(error){
      setMessage(error instanceof Error?error.message:"تعذر حفظ الملاحظة");
    }finally{setBusy(false);}
  }

  async function remove(noteId?:string){
    if(!noteId||!selectedStudent)return;
    if(!confirm("حذف هذه الملاحظة؟"))return;
    setBusy(true);
    try{
      const response=await fetch("/api/teacher/notes",{
        method:"DELETE",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({subjectId,studentCode:selectedStudent.code,noteId}),
      });
      if(!response.ok)throw new Error();
      await load();
      setMessage("تم حذف الملاحظة.");
    }catch{
      setMessage("تعذر حذف الملاحظة.");
    }finally{setBusy(false);}
  }

  return <main className="notes-v13" dir="rtl">
    {message?<div className="nv13-message">{message}</div>:null}

    <section className="nv13-classbar">
      <div className="nv13-classbar-title">
        <small>فصول المادة</small>
        <strong>اختر الفصل وابدأ المتابعة مباشرة</strong>
      </div>
      <div className="nv13-class-tabs">
        {classes.map(name=><button type="button" key={name} className={name===className?"active":""} onClick={()=>{setClassName(name);setSearch("");}}>
          <b>{name}</b><span>{classCounts[name]||0}</span>
        </button>)}
        {!classes.length?<span className="nv13-no-classes">لا توجد فصول مسندة.</span>:null}
      </div>
      <div className="nv13-class-summary">
        <span><b>{classNotes}</b> ملاحظة</span>
        <span><b>{classFollowed}</b> طالب تمت متابعته</span>
      </div>
    </section>

    <section className="nv13-layout">
      <aside className="nv13-roster">
        <header>
          <div><small>{className||"الفصل"}</small><h2>الطلاب</h2></div>
          <span>{studentsInClass.length}</span>
        </header>
        <label className="nv13-search">
          <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="ابحث عن طالب أو كود"/>
          <span>بحث</span>
        </label>
        <div className="nv13-student-list">
          {visibleStudents.map(student=>{
            const count=noteCount(student.code);
            return <button type="button" key={student.code} className={student.code===studentCode?"active":""} onClick={()=>setStudentCode(student.code)}>
              <i>{student.name.trim().charAt(0)||"ط"}</i>
              <span><b>{student.name}</b><small>{student.code}</small></span>
              <em className={count?"has-notes":""}>{count||"—"}</em>
            </button>;
          })}
          {!visibleStudents.length?<p className="nv13-empty-list">لا توجد نتائج.</p>:null}
        </div>
      </aside>

      <section className="nv13-focus">
        {selectedStudent?<>
          <header className="nv13-student-hero">
            <div className="nv13-student-avatar">{selectedStudent.name.trim().charAt(0)||"ط"}</div>
            <div className="nv13-student-copy">
              <small>الطالب المختار</small>
              <h2>{selectedStudent.name}</h2>
              <p>{selectedStudent.className} • {session?.subject||"المادة"} • {selectedStudent.code}</p>
            </div>
            <div className="nv13-student-state">
              <b>{selectedNotes.length}</b>
              <span>ملاحظة محفوظة</span>
              <small>{selectedNotes[0]?.createdAt?`آخر متابعة: ${arabicDate(selectedNotes[0].createdAt)}`:"لا توجد متابعة سابقة"}</small>
            </div>
          </header>

          <section className="nv13-compose-card">
            <div className="nv13-section-head">
              <div><small>نوع الملاحظة</small><h3>اختر الحالة المناسبة</h3></div>
              <span>لن يُحفظ شيء قبل ضغط زر الحفظ</span>
            </div>

            <div className="nv13-presets">
              {presets.map((item,index)=><button type="button" key={`${item.type}-${item.label}`} data-tone={item.tone} className={selectedPreset===index&&!custom.trim()?"active":""} onClick={()=>{setSelectedPreset(index);setCustom("");}}>
                <i>{item.group.charAt(0)}</i>
                <span><small>{item.group}</small><b>{item.label}</b></span>
              </button>)}
            </div>

            <div className="nv13-editor-wrap">
              <div className="nv13-editor-head">
                <div><small>صياغة الملاحظة</small><b>{custom.trim()?"نص مخصص من المعلم":preset.label}</b></div>
                <div>
                  <button type="button" onClick={()=>setCustom(preset.message)}>تعديل الصياغة المقترحة</button>
                  {custom?<button type="button" onClick={()=>setCustom("")}>العودة للمقترح</button>:null}
                </div>
              </div>
              <textarea value={custom} onChange={event=>setCustom(event.target.value)} placeholder={preset.message}/>
              <div className="nv13-live-preview">
                <span>سيظهر للطالب وولي الأمر:</span>
                <p>{noteText}</p>
              </div>
            </div>

            <div className="nv13-actions">
              <span>راجع الاسم والنص قبل الحفظ.</span>
              <button type="button" disabled={busy} onClick={()=>void save()}>{busy?"جارٍ الحفظ…":"حفظ الملاحظة"}</button>
            </div>
          </section>

          <section className="nv13-history">
            <div className="nv13-section-head">
              <div><small>سجل الطالب</small><h3>الملاحظات السابقة</h3></div>
              <span>{selectedNotes.length} ملاحظة</span>
            </div>
            <div className="nv13-timeline">
              {selectedNotes.map(note=><article key={note.id||`${note.createdAt}-${note.message}`}>
                <i/>
                <div>
                  <header><div><b>{note.label||"ملاحظة"}</b><small>{arabicDate(note.createdAt)}</small></div><button type="button" disabled={busy} onClick={()=>void remove(note.id)}>حذف</button></header>
                  <p>{note.message}</p>
                </div>
              </article>)}
              {!selectedNotes.length?<div className="nv13-no-history"><b>لا توجد ملاحظات سابقة</b><span>أول ملاحظة تحفظها لهذا الطالب ستظهر هنا.</span></div>:null}
            </div>
          </section>
        </>:<div className="nv13-empty-focus"><b>اختر طالبًا</b><span>ستظهر مساحة الملاحظة وسجل المتابعة هنا.</span></div>}
      </section>
    </section>
  </main>;
}
