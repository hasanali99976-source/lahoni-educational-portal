"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";
import { useTeacherClient } from "../../../lib/teacher-client";
import { saveLocalClasses, saveLocalRoster, type UnifiedStudent } from "../../../lib/unified-roster";
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
  const teacherId = session?.teacherId || "";
  const [students,setStudents] = useState<Student[]>([]);
  const [classes,setClasses] = useState<SchoolClass[]>([]);
  const [availableClasses,setAvailableClasses] = useState<SchoolClass[]>([]);
  const [selectedClassIds,setSelectedClassIds] = useState<string[]>([]);
  const [selectedClass,setSelectedClass] = useState("");
  const [search,setSearch] = useState("");
  const [message,setMessage] = useState("");
  const [loading,setLoading] = useState(false);
  const [savingScope,setSavingScope] = useState(false);
  const [managing,setManaging] = useState(false);
  const [qrStudent,setQrStudent] = useState<Student|null>(null);

  async function load() {
    if (!subjectId) return;
    setLoading(true); setMessage("");
    try {
      const data = await fetchRoster(subjectId);
      const nextStudents = Array.isArray(data.students) ? data.students : [];
      const nextClasses = Array.isArray(data.classes) ? data.classes : [];
      const nextAvailable = Array.isArray(data.availableClasses) ? data.availableClasses : nextClasses;
      const nextSelected = Array.isArray(data.selectedClassIds) ? data.selectedClassIds : nextClasses.map((item:SchoolClass)=>item.id);
      setStudents(nextStudents);
      setClasses(nextClasses);
      setAvailableClasses(nextAvailable);
      setSelectedClassIds(nextSelected);
      setSelectedClass(current => current && nextClasses.some((item:SchoolClass)=>item.id===current) ? current : (nextClasses[0]?.id || ""));
      if (teacherId) {
        saveLocalRoster(teacherId, nextStudents as UnifiedStudent[], subjectId);
        saveLocalClasses(teacherId, nextClasses.map((item:SchoolClass)=>item.name), subjectId);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل قائمة الطلاب");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [subjectId,teacherId]);

  const activeClass = classes.find(item=>item.id===selectedClass);
  const visible = useMemo(() => students.filter(student => {
    const classMatch = !activeClass || (student.grade===activeClass.grade && student.section===activeClass.section);
    const query = search.trim().toLocaleLowerCase("ar");
    return classMatch && (!query || student.name.toLocaleLowerCase("ar").includes(query) || student.code.toLowerCase().includes(query));
  }), [students,activeClass,search]);

  function toggleClass(classId:string) {
    setSelectedClassIds(current => current.includes(classId)
      ? current.filter(item=>item!==classId)
      : [...current,classId]);
  }

  async function saveClassScope() {
    if (!subjectId) return;
    setSavingScope(true); setMessage("");
    try {
      const response = await fetch("/api/teacher/class-scope", {
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({subjectId,selectedClassIds}),
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.message || "تعذر حفظ الفصول");
      setMessage("تم حفظ فصولك. الفصول المخفية لم تُحذف ويمكن إعادتها في أي وقت.");
      setManaging(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حفظ الفصول");
    } finally { setSavingScope(false); }
  }

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
    <header className="teacher-central-head"><div><small>القائمة الرسمية</small><h1>طلاب {session?.subject || "المادة"}</h1><p>حدّد الفصول التي تدرّسها فعلًا. إخفاء فصل لا يحذف أسماء الطلاب أو التحضير أو الدرجات، ويمكن إعادته في أي وقت.</p></div><div><button type="button" onClick={()=>setManaging(value=>!value)}>{managing?"إغلاق إدارة الفصول":"إدارة فصولي"}</button><button type="button" onClick={()=>void load()} disabled={loading}>{loading?"جارٍ التحديث...":"تحديث القائمة"}</button><button type="button" onClick={exportExcel}>تصدير Excel</button></div></header>
    {message && <p className="teacher-central-message">{message}</p>}
    {managing&&<section className="teacher-class-manager"><div><h2>الفصول التابعة لي في {session?.subject || "المادة"}</h2><p>أزل علامة الفصل الذي لا تدرّسه، أو أعد تحديده لاحقًا. لا يتم حذف أي بيانات محفوظة.</p></div><div className="teacher-class-options">{availableClasses.map(item=><label key={item.id} className={selectedClassIds.includes(item.id)?"selected":""}><input type="checkbox" checked={selectedClassIds.includes(item.id)} onChange={()=>toggleClass(item.id)}/><strong>{item.name}</strong><span>{students.filter(student=>student.grade===item.grade&&student.section===item.section).length} طالب ظاهر حاليًا</span></label>)}{!availableClasses.length&&<p>لا توجد فصول متاحة لهذه المادة.</p>}</div><div className="teacher-class-actions"><button type="button" onClick={()=>void saveClassScope()} disabled={savingScope}>{savingScope?"جارٍ الحفظ...":"حفظ فصولي"}</button><small>الفصل المرتبط بمعلم آخر لن يقبل النظام إضافته منعًا لتكرار المادة عند الطالب.</small></div></section>}
    <div className="teacher-central-classes">{classes.map(item=><button type="button" key={item.id} className={selectedClass===item.id?"active":""} onClick={()=>setSelectedClass(item.id)}><strong>{item.name}</strong><span>{students.filter(student=>student.grade===item.grade&&student.section===item.section).length} طالب</span></button>)}{!classes.length&&!loading&&<p>لا توجد فصول مفعّلة لهذه المادة. افتح «إدارة فصولي» لإضافة فصل.</p>}</div>
    <div className="teacher-central-search"><label>بحث<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="اسم الطالب أو الكود" /></label><strong>{activeClass?.name || "اختر الفصل"}</strong></div>
    <div className="teacher-central-list">{visible.map((student,index)=><article key={student.id}><b>{index+1}</b><div><strong>{student.name}</strong><small>{student.className}</small></div><code>{student.code}</code><button type="button" onClick={()=>setQrStudent(student)}>رمز الطالب</button></article>)}{!visible.length&&!loading&&<p className="teacher-central-empty">لا يوجد طلاب في هذا الفصل.</p>}</div>
    {qrStudent&&<div className="teacher-central-modal"><section><button type="button" onClick={()=>setQrStudent(null)}>×</button><h2>{qrStudent.name}</h2><QRCodeSVG value={`${window.location.origin}/student/qr/${qrStudent.code}`} size={220}/><strong>{qrStudent.code}</strong><small>{qrStudent.className}</small></section></div>}
  </section></main>;
}
