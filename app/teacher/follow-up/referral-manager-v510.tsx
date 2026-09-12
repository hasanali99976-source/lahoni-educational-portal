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
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>المحالون للمرشد الطلابي</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#15333a}h1{margin:0;color:#0a625f}p{color:#60737a}table{width:100%;border-collapse:collapse;margin-top:22px;font-size:13px}th,td{border:1px solid #cfdcda;padding:9px;text-align:right;vertical-align:top}th{background:#0b716d;color:white}.meta{display:flex;gap:22px;flex-wrap:wrap;margin-top:12px;padding:12px;background:#eef7f6;border-radius:10px}@media print{body{padding:0}.no-print{display:none}}</style></head><body><h1>بوابة أستاذ لحوني التعليمية</h1><p>قائمة الطلاب المحالين للمرشد الطلابي</p><div class="meta"><b>المعلم: ${esc(session.teacherName || "المعلم")}</b><b>المادة: ${esc(subject)}</b><b>عدد المحالين: ${items.length}</b></div><table><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>نوع الإحالة</th><th>السبب</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${rows || `<tr><td colspan="7">لا توجد إحالات.</td></tr>`}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    win.document.close();
  }

  return <section className="referral-manager-v510" dir="rtl">
    <details className="referral-drawer-v511" open>
      <summary>
        <div className="referral-summary-main-v511">
          <span className="referral-summary-icon-v511" aria-hidden="true">↗</span>
          <div><small>للمعلم — يظهر قبل بقية المتابعة</small><strong>المحالون للمرشد الطلابي</strong><p>{loading ? "جارٍ تحميل الطلاب المحالين…" : items.length ? "هذه قائمة الطلاب الذين تمت إحالتهم للمرشد؛ يمكنك مراجعتها وطباعتها مباشرة." : "لا توجد إحالات مسجلة في هذه المادة."}</p></div>
        </div>
        <div className="referral-summary-actions-v511"><b className="referral-total-v511">{loading ? "…" : items.length}</b><span className="referral-open-label-v511">المحالون</span></div>
      </summary>
      <div className="referral-drawer-body-v511">
        <div className="referral-toolbar-v511"><div><b>الطلاب المحالون للمرشد الطلابي</b><small>{items.length} إحالة محفوظة لهذه المادة</small></div><button type="button" onClick={printAll} disabled={loading || !items.length}>طباعة قائمة المحالين</button></div>
        {loading ? <div className="referral-loading-v510">جارٍ تحميل قائمة المحالين…</div> : items.length ? <div className="referral-list-v511">{items.map((item, index) => <article key={item.id} className="referral-item-v511">
          <span className="referral-index-v511">{index + 1}</span>
          <div className="referral-person-v511"><strong>{item.studentName || "—"}</strong><small>{item.className || "الفصل غير محدد"}</small></div>
          <div className="referral-kind-v511"><span>{item.referralTypeLabel || "إحالة للمرشد"}</span><small>{item.status || "جديدة"}</small></div>
          <p className="referral-reason-v511">{item.reason || "بدون سبب مسجل"}</p>
          <time className="referral-date-v511">{dateLabel(item.createdAt)}</time>
          <button type="button" className="referral-delete-v511" disabled={deleting === item.id} onClick={() => void removeReferral(item)}>{deleting === item.id ? "جارٍ الحذف…" : "حذف"}</button>
        </article>)}</div> : <div className="referral-empty-v511">لا توجد إحالات مسجلة في هذه المادة.</div>}
      </div>
    </details>
  </section>;
}
