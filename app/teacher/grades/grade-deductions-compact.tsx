"use client";

import { useState } from "react";
import GradeDeductionsPanel from "./grade-deductions-panel";
import "./grade-deductions-compact.css";

export default function GradeDeductionsCompact() {
  const [open, setOpen] = useState(false);
  return <>
    <section className="gded-compact" dir="rtl">
      <div><small>التحصيل العلمي</small><b>الخصومات والتعديلات</b><span>لا تظهر التفاصيل إلا عند الحاجة، والدرجة الأصلية تبقى محفوظة.</span></div>
      <button type="button" onClick={() => setOpen(true)}>إدارة الخصم</button>
    </section>
    {open ? <div className="gded-dialog" role="dialog" aria-modal="true">
      <div className="gded-dialog-shell">
        <header><div><small>أداة مستقلة</small><b>الخصومات والتعديلات</b></div><button type="button" onClick={() => setOpen(false)} aria-label="إغلاق">×</button></header>
        <div className="gded-dialog-body"><GradeDeductionsPanel /></div>
      </div>
    </div> : null}
  </>;
}
