"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";

type Referral = {
  id: string;
  studentName?: string;
  className?: string;
  reason?: string;
  referralTypeLabel?: string;
  status?: string;
  subject?: string;
  createdAt?: string;
};

function dateLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function esc(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

export default function ReferralManagerV510() {
  const session = useTeacherClient();
  const teacherId = session.teacherId || "";
  const subjectKey = session.subjectKey || "history";
  const subject = session.subject || "المادة";
  const [items, setItems] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState("");
  const path = useMemo(() => teacherId ? tenantCollection(teacherId, subjectKey as never, "counselorReferrals") : "", [teacherId, subjectKey]);

  useEffect(() => {
    if (!path) return;
    setLoading(true);
    return onSnapshot(collection(db, path), snapshot => {
      setItems(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Referral).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
      setLoading(false);
    }, () => setLoading(false));
  }, [path]);

  async function removeReferral(item: Referral) {
    if (!path || deleting) return;
    if (!window.confirm(`حذف إحالة ${item.studentName || "الطالب"}؟`)) return;
    setDeleting(item.id);
    try { await deleteDoc(doc(db, path, item.id)); } finally { setDeleting(""); }
  }

  function printAll() {
    const win = window.open("", "_blank", "width=1000,height=800");
    if (!win) return;
    const rows = items.map((item, index) => `<tr><td>${index + 1}</td><td>${esc(item.studentName || "—")}</td><td>${esc(item.className || "—")}</td><td>${esc(item.referralTypeLabel || "إحالة للمرشد")}</td><td>${esc(item.reason || "—")}</td><td>${esc(item.status || "جديدة")}</td><td>${esc(dateLabel(item.createdAt))}</td></tr>`).join("");
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>إحالات المرشد</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#15333a}h1{margin:0;color:#0a625f}p{color:#60737a}table{width:100%;border-collapse:collapse;margin-top:22px;font-size:13px}th,td{border:1px solid #cfdcda;padding:9px;text-align:right;vertical-align:top}th{background:#0b716d;color:white}.meta{display:flex;gap:22px;flex-wrap:wrap;margin-top:12px;padding:12px;background:#eef7f6;border-radius:10px}@media print{body{padding:0}.no-print{display:none}}</style></head><body><h1>بوابة أستاذ لحوني التعليمية</h1><p>سجل إحالات المرشد الطلابي</p><div class="meta"><b>المعلم: ${esc(session.teacherName || "المعلم")}</b><b>المادة: ${esc(subject)}</b><b>عدد الإحالات: ${items.length}</b></div><table><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>نوع الإحالة</th><th>السبب</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${rows || `<tr><td colspan="7">لا توجد إحالات.</td></tr>`}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    win.document.close();
  }

  return <section className="referral-manager-v510" dir="rtl">
    <header><div><small>سجل المتابعة مع المرشد</small><h2>إحالاتي للمرشد الطلابي</h2><p>راجع كل إحالات هذه المادة، اطبعها دفعة واحدة، أو احذف إحالة غير مطلوبة.</p></div><button type="button" onClick={printAll} disabled={loading || !items.length}>طباعة جميع الإحالات</button></header>
    {loading ? <div className="referral-loading-v510">جارٍ تحميل سجل الإحالات…</div> : <div className="referral-table-v510"><table><thead><tr><th>الطالب</th><th>الفصل</th><th>نوع الإحالة</th><th>السبب</th><th>التاريخ</th><th>إجراء</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><b>{item.studentName || "—"}</b></td><td>{item.className || "—"}</td><td>{item.referralTypeLabel || "إحالة للمرشد"}</td><td>{item.reason || "—"}</td><td>{dateLabel(item.createdAt)}</td><td><button type="button" className="delete" disabled={deleting === item.id} onClick={() => void removeReferral(item)}>{deleting === item.id ? "جارٍ الحذف…" : "حذف الإحالة"}</button></td></tr>)}{!items.length ? <tr><td colSpan={6}>لا توجد إحالات مسجلة في هذه المادة.</td></tr> : null}</tbody></table></div>}
  </section>;
}
