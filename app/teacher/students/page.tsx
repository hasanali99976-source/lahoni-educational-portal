"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./central-roster.css";

type Student = { id:string; code:string; name:string; grade:number; section:string; className:string; active:boolean };
type SchoolClass = { id:string; grade:number; section:string; name:string; active:boolean };

async function fetchRoster(subjectId:string) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`/api/teacher/students?subjectId=${encodeURIComponent(subjectId)}`, { cache:"no-store", signal:controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "تعذر تحميل قائمة الطلاب");
    return data;
  } finally { window.clearTimeout(timer); }
}

export default function StudentsPage() {
  const session = useTeacherClient();
  const subjectId = session?.subjectKey || "";
  const [students,setStudents] = useState<Student[]>([]);
  const [classes,setClasses] = useState<SchoolClass[]>([]);
  const [selectedClass,setSelectedClass] = useState("");
  const [search,setSearch] = useState("");
  const [message,setMessage] = useState("");
  const [loading,setLoading] = useState(false);
  const [qrStudent,setQrStudent] = useState<Student|null>(null);

  async function load() {
    if (!subjectId) return;
    setLoading(true); setMessage("");
    try {
      const data = await fetchRoster(subjectId);
      const nextStudents = Array.isArray(data.students) ? data.students : [];
      const nextClasses = Array.isArray(data.classes) ? data.classes : [];
      setStudents(nextStudents); setClasses(nextClasses);
      setSelectedClass(current => current && nextClasses.some((item:SchoolClass)=>item.id===current) ? current : (nextClasses[0]?.id || ""));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل قائمة الطلاب");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [subjectId]);

  const activeClass = classes.find(item=>item.id===selectedClass);
  const visible = useMemo(() => students.filter(student => {
    const classMatch = !activeClass || (student.grade===activeClass.grade && student.section===activeClass.section);
    const query = search.trim().toLocaleLowerCase("ar");
    return classMatch && (!query || student.name.toLocaleLowerCase("ar").includes(query) || student.code.toLowerCase().includes(query));
  }), [students,activeClass,search]);

  function exportExcel() {
    const rows = visible.map((student,index)=>({ م:index+1, "اسم الطالب":student.name, "الفصل":student.className, "كود الطالب":student.code }));
    if (!rows.length) return setMessage("لا توجد أسماء للتصدير");
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{wch:6},{wch:32},{wch:22},{wch:16}];
    XLSX.utils.book_append_sheet(workbook,sheet,"الطلاب");
    XLSX.writeFile(workbook,`طلاب-${activeClass?.name || "المادة"}.xlsx`);
  }

  return <main className="teacher-central-roster" dir="rtl"><section className="teacher-central-card">
    <header className="teacher-central-head"><div><small>القائمة الرسمية</small><h1>طلاب {session?.subject || "المادة"}</h1><p>تظهر هنا تلقائيًا الصفوف والفصول المسندة لك من بوابة المدير. تعديل الاسم أو نقل الطالب يتم من الإدارة فقط.</p></div><div><button type="button" onClick={()=>void load()} disabled={loading}>{loading?"جارٍ التحديث...":"تحديث القائمة"}</button><button type="button" onClick={exportExcel}>تصدير Excel</button></div></header>
    {message && <p className="teacher-central-message">{message}</p>}
    <div className="teacher-central-classes">{classes.map(item=><button type="button" key={item.id} className={selectedClass===item.id?"active":""} onClick={()=>setSelectedClass(item.id)}><strong>{item.name}</strong><span>{students.filter(student=>student.grade===item.grade&&student.section===item.section).length} طالب</span></button>)}{!classes.length&&!loading&&<p>لا توجد فصول مسندة لهذه المادة.</p>}</div>
    <div className="teacher-central-search"><label>بحث<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="اسم الطالب أو الكود" /></label><strong>{activeClass?.name || "اختر الفصل"}</strong></div>
    <div className="teacher-central-list">{visible.map((student,index)=><article key={student.id}><b>{index+1}</b><div><strong>{student.name}</strong><small>{student.className}</small></div><code>{student.code}</code><button type="button" onClick={()=>setQrStudent(student)}>رمز الطالب</button></article>)}{!visible.length&&!loading&&<p className="teacher-central-empty">لا يوجد طلاب في هذا الفصل.</p>}</div>
    {qrStudent&&<div className="teacher-central-modal"><section><button type="button" onClick={()=>setQrStudent(null)}>×</button><h2>{qrStudent.name}</h2><QRCodeSVG value={`${window.location.origin}/student/qr/${qrStudent.code}`} size={220}/><strong>{qrStudent.code}</strong><small>{qrStudent.className}</small></section></div>}
  </section></main>;
}
