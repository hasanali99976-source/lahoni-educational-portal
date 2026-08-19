"use client";

import { useMemo, useState } from "react";
import "./smart-edu-assistant.css";

const answers: Record<string, string> = {
  "كيف أرفع مستواي؟": "ابدأ بأقل وحدة حصلت فيها على درجة، ثم راجع الحضور والواجبات والاختبار. ركّز على خطوة واحدة يوميًا وسجّل تقدمك.",
  "وش أراجع اليوم؟": "راجع آخر وحدة تم رصدها، ثم اختبر نفسك بثلاثة أسئلة قصيرة. بعد ذلك انتقل للنقطة الأقل إتقانًا.",
  "كيف أتابع الطالب؟": "تابع الحضور أولًا، ثم قارن درجات الوحدات، وبعدها حدّد هدفًا أسبوعيًا واضحًا للطالب وراجعه معه.",
  "كيف أنظم موادي؟": "رتّب المواد حسب الصف والشعبة، ثم اجعل لكل مادة خطة أسبوعية، واجبات واضحة، وتنبيهًا عند انخفاض الأداء.",
};

export default function SmartEduAssistant() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("اختر سؤالًا سريعًا أو اكتب سؤالك التعليمي.");
  const suggestions = useMemo(() => Object.keys(answers), []);

  function ask(value?: string) {
    const q = (value ?? question).trim();
    if (!q) return;
    const exact = answers[q];
    const smartReply = exact || (q.includes("حضور")
      ? "راجع سجل الحضور وحدد أكثر الأيام تكرارًا للغياب أو التأخر، ثم اربطها بخطة متابعة قصيرة وواضحة."
      : q.includes("درجة") || q.includes("مستوى")
      ? "ابدأ بمقارنة الوحدات المرصودة، وحدد أقل درجة، ثم ضع هدفًا صغيرًا قابلًا للقياس للوحدة القادمة."
      : q.includes("مادة")
      ? "اختر المادة من لوحة المعلم، وحدد الصف والشعبة، ثم تأكد من ظهورها في بوابة ولي الأمر / الطالب."
      : "قسّم هدفك إلى خطوة تعليمية صغيرة: حدّد المطلوب، راجع البيانات الحالية، ثم اختر الإجراء الأقرب للتحسن.");
    setReply(smartReply);
    setQuestion(q);
  }

  return (
    <>
      <button className="edu-ai-fab" onClick={() => setOpen(true)} aria-label="فتح المساعد التعليمي الذكي">
        <span>✦</span><b>المساعد الذكي</b>
      </button>
      {open && (
        <div className="edu-ai-overlay" onClick={() => setOpen(false)}>
          <section className="edu-ai-panel" dir="rtl" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><small>مساعد لحوني</small><h2>المساعد التعليمي الذكي</h2></div>
              <button onClick={() => setOpen(false)} aria-label="إغلاق">×</button>
            </header>
            <div className="edu-ai-answer"><span>✦</span><p>{reply}</p></div>
            <div className="edu-ai-suggestions">
              {suggestions.map((item) => <button key={item} onClick={() => ask(item)}>{item}</button>)}
            </div>
            <div className="edu-ai-input">
              <input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(); }} placeholder="اكتب سؤالك التعليمي..." />
              <button onClick={() => ask()}>إرسال</button>
            </div>
            <small className="edu-ai-note">إرشاد ذكي داخل المنصة، ولا يغيّر الدرجات أو البيانات.</small>
          </section>
        </div>
      )}
    </>
  );
}
