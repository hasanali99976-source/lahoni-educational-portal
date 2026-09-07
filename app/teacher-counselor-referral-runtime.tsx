"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useTeacherClient } from "../lib/teacher-client";

type Student = { id: string; code?: string; name?: string; class?: string; className?: string };
type ReferralType = "mastery" | "other";

export default function TeacherCounselorReferralRuntime() {
  const pathname = usePathname();
  const session = useTeacherClient();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ReferralType>("mastery");
  const [reason, setReason] = useState("الحاجة إلى دعم في الإتقان والتحصيل");
  const [openWhatsapp, setOpenWhatsapp] = useState(true);
  const [message, setMessage] = useState("");

  const subjectId = String(session.subjectKey || "").split("--")[0];
  const subjectLabel = String(session.subject || "المادة");
  const activeGrade = session.activeGrade || null;

  useEffect(() => {
    if (pathname !== "/teacher/follow-up") { setHost(null); return; }
    const locate = () => {
      const next = document.querySelector(".follow-actions") as HTMLElement | null;
      setHost(current => current === next ? current : next);
    };
    locate();
    const timers = [150, 500, 1200].map(delay => window.setTimeout(locate, delay));
    return () => timers.forEach(id => window.clearTimeout(id));
  }, [pathname]);

  async function loadStudents() {
    if (!subjectId || loading) return;
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ subjectId });
      if (activeGrade) params.set("grade", String(activeGrade));
      const response = await fetch(`/api/teacher/students?${params.toString()}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "تعذر تحميل الطلاب.");
      const rows = Array.isArray(data.students) ? data.students as Student[] : [];
      setStudents(rows);
      setSelected([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل الطلاب.");
    } finally {
      setLoading(false);
    }
  }

  function showModal() {
    setOpen(true);
    setType("mastery");
    setReason("الحاجة إلى دعم في الإتقان والتحصيل");
    setClassFilter("");
    setSearch("");
    setMessage("");
    void loadStudents();
  }

  function changeType(next: ReferralType) {
    setType(next);
    setReason(next === "mastery" ? "الحاجة إلى دعم في الإتقان والتحصيل" : "");
  }

  const classes = useMemo(() => [...new Set(students.map(student => String(student.className || student.class || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar", { numeric: true })), [students]);
  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("ar");
    return students.filter(student => {
      const className = String(student.className || student.class || "").trim();
      if (classFilter && className !== classFilter) return false;
      if (!q) return true;
      return String(student.name || "").toLocaleLowerCase("ar").includes(q) || String(student.code || student.id).toLowerCase().includes(q);
    });
  }, [students, classFilter, search]);

  async function sendReferral() {
    if (!selected.length) return setMessage("حدد طالبًا واحدًا على الأقل.");
    if (reason.trim().length < 3) return setMessage("اكتب سبب الإحالة بوضوح.");
    setSending(true);
    setMessage("");
    try {
      const response = await fetch("/api/teacher/counselor-referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, subjectLabel, referralType: type, reason: reason.trim(), studentCodes: selected }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "تعذر تسجيل الإحالة.");
      setMessage(data.message || "تم تسجيل الإحالة.");
      if (openWhatsapp && data.counselorPhone && data.whatsappText) {
        window.open(`https://wa.me/${encodeURIComponent(String(data.counselorPhone))}?text=${encodeURIComponent(String(data.whatsappText))}`, "_blank", "noopener,noreferrer");
      }
      window.setTimeout(() => setOpen(false), 650);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تسجيل الإحالة.");
    } finally {
      setSending(false);
    }
  }

  if (pathname !== "/teacher/follow-up") return null;

  return <>
    {host ? createPortal(<button type="button" className="counselor-button-v2" onClick={showModal}>إحالة للمرشد</button>, host) : null}
    {open ? <div className="counselor-v2-backdrop" onClick={() => setOpen(false)}><section className="counselor-v2-modal" onClick={event => event.stopPropagation()} dir="rtl">
      <header><div><small>{subjectLabel}</small><h2>إحالة للمرشد الطلابي</h2><p>يمكن إحالة أي طالب حتى لو لم يبدأ رصد درجاته.</p></div><button type="button" onClick={() => setOpen(false)}>×</button></header>

      <div className="counselor-v2-types">
        <button type="button" className={type === "mastery" ? "active" : ""} onClick={() => changeType("mastery")}><b>مرتبطة بالإتقان</b><span>تحصيل، إتقان، حاجة لدعم أكاديمي</span></button>
        <button type="button" className={type === "other" ? "active" : ""} onClick={() => changeType("other")}><b>إحالة أخرى</b><span>سلوك، حضور، تفاعل، أو أي مشكلة يحددها المعلم</span></button>
      </div>

      <div className="counselor-v2-filters"><select value={classFilter} onChange={event => setClassFilter(event.target.value)}><option value="">كل الفصول</option>{classes.map(name => <option key={name}>{name}</option>)}</select><input value={search} onChange={event => setSearch(event.target.value)} placeholder="بحث بالاسم أو الكود" /></div>

      <div className="counselor-v2-list-head"><b>الطلاب</b><button type="button" onClick={() => setSelected(visible.map(student => String(student.code || student.id)))}>تحديد الظاهر</button><button type="button" onClick={() => setSelected([])}>إلغاء التحديد</button><span>{selected.length} محدد</span></div>
      <div className="counselor-v2-list">{loading ? <p>جارٍ تحميل الطلاب…</p> : visible.map(student => {
        const code = String(student.code || student.id);
        return <label key={student.id}><input type="checkbox" checked={selected.includes(code)} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, code])] : current.filter(item => item !== code))} /><span><b>{student.name || "طالب"}</b><small>{student.className || student.class || "فصل غير محدد"} • {code}</small></span></label>;
      })}{!loading && !visible.length ? <p>لا يوجد طلاب مطابقون.</p> : null}</div>

      <label className="counselor-v2-reason"><span>سبب الإحالة الذي سيظهر في بوابة الطالب وولي الأمر</span><textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="اكتب السبب بوضوح…" /></label>
      <label className="counselor-v2-whatsapp"><input type="checkbox" checked={openWhatsapp} onChange={event => setOpenWhatsapp(event.target.checked)} /><span>فتح واتساب المرشد بعد تسجيل الإحالة</span></label>
      <p className="counselor-v2-visibility">الإحالة تظهر للطالب وولي الأمر كتنبيه مرتفع الأولوية فور تحديث البوابة.</p>
      {message ? <div className="counselor-v2-message">{message}</div> : null}
      <footer><button type="button" onClick={() => setOpen(false)}>إلغاء</button><button type="button" className="primary" disabled={sending || loading} onClick={() => void sendReferral()}>{sending ? "جارٍ التسجيل…" : "تسجيل الإحالة"}</button></footer>
    </section></div> : null}
  </>;
}
