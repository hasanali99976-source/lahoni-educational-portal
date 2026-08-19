"use client";

import { FormEvent, useMemo, useState } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";
import "./teacher-ai.css";

const tools = [
  { title: "تلخيص درس", hint: "حوّل المحتوى إلى شرح مختصر وواضح", prompt: "لخّص هذا الدرس للطلاب بأسلوب واضح:" },
  { title: "إنشاء أسئلة", hint: "أسئلة متنوعة مع إجابات", prompt: "أنشئ أسئلة متنوعة مع الإجابات عن:" },
  { title: "خطة علاجية", hint: "اقتراح خطوات للطلاب المتعثرين", prompt: "اقترح خطة علاجية عملية للطلاب المتعثرين في:" },
  { title: "تحليل الدرجات", hint: "استنتاجات وتوصيات تعليمية", prompt: "حلل نتائج الطلاب واقترح توصيات بناءً على:" },
];

function buildResponse(text: string, subject: string) {
  const clean = text.trim();
  if (!clean) return "اكتب طلبك أولًا، مثل: أنشئ لي أسئلة عن الوحدة الأولى.";
  if (clean.includes("أسئلة") || clean.includes("اختبار")) return `إليك نموذجًا سريعًا لمادة ${subject}:\n\n١) سؤال معرفة مباشر.\n٢) سؤال تفسير وتحليل.\n٣) سؤال تطبيق على موقف جديد.\n٤) سؤال اختيار من متعدد بأربع بدائل.\n\nيمكنك كتابة عنوان الدرس لأحوّلها إلى أسئلة دقيقة.`;
  if (clean.includes("خطة") || clean.includes("علاج")) return `خطة علاجية مقترحة لمادة ${subject}:\n\n• تشخيص المهارة غير المتقنة.\n• شرح مصغر لا يتجاوز ٧ دقائق.\n• نشاط تطبيقي متدرج.\n• تقويم سريع من ٣ أسئلة.\n• إعادة المحاولة مع تغذية راجعة مباشرة.`;
  if (clean.includes("لخص") || clean.includes("تلخيص")) return `سأحوّل المحتوى إلى: فكرة رئيسية، مفاهيم أساسية، تسلسل مبسط، ثم سؤال ختامي. أرسل نص الدرس أو عنوانه لبدء التلخيص.`;
  if (clean.includes("درجات") || clean.includes("نتائج")) return `لتحليل النتائج في ${subject}، ركّز على: متوسط الفصل، المهارات الأقل إتقانًا، الطلاب دون ٦٠٪، الفروق بين الوحدات، ثم ضع إجراءً علاجيًا لكل فجوة.`;
  return `فهمت طلبك في مادة ${subject}. أستطيع مساعدتك في التلخيص، الأسئلة، الخطط العلاجية، تحليل النتائج، وصياغة التغذية الراجعة. أضف اسم الدرس أو البيانات المطلوبة لتكون النتيجة أدق.`;
}

export default function TeacherAiPage() {
  const session = useTeacherClient();
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("مرحبًا بك في مساعد لحوني الذكي. اختر أداة أو اكتب طلبك مباشرة.");
  const subject = session?.subject || "المادة الحالية";
  const suggestions = useMemo(() => [
    `أنشئ ٥ أسئلة قصيرة في ${subject}`,
    `اقترح خطة علاجية في ${subject}`,
    `اكتب تغذية راجعة لطالب متعثر`,
  ], [subject]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    setAnswer(buildResponse(input, subject));
  }

  return <main className="teacher-ai-page" dir="rtl">
    <section className="teacher-ai-hero">
      <div><span>AI</span><h1>المساعد الذكي للمعلم</h1><p>يساعدك في التخطيط، التلخيص، صناعة الأسئلة وتحليل الأداء داخل مادة {subject}.</p></div>
      <div className="teacher-ai-status"><i></i><b>جاهز للمساعدة</b><small>المادة الحالية: {subject}</small></div>
    </section>

    <section className="teacher-ai-tools">
      {tools.map(tool => <button key={tool.title} onClick={() => { setInput(`${tool.prompt} `); setAnswer(`أضف عنوان الدرس أو المحتوى بعد عبارة «${tool.prompt}» ثم اضغط إرسال.`); }}>
        <strong>{tool.title}</strong><small>{tool.hint}</small><span>فتح الأداة ←</span>
      </button>)}
    </section>

    <section className="teacher-ai-chat">
      <header><div><b>محادثة تعليمية ذكية</b><small>اكتب طلبك بالعربية بشكل مباشر</small></div><span>✦</span></header>
      <div className="teacher-ai-answer">{answer.split("\n").map((line, index) => <p key={index}>{line || " "}</p>)}</div>
      <form onSubmit={submit}>
        <textarea value={input} onChange={event => setInput(event.target.value)} placeholder="مثال: أنشئ لي ١٠ أسئلة اختيار من متعدد عن الدرس..." />
        <button type="submit">إرسال الطلب</button>
      </form>
      <div className="teacher-ai-suggestions">{suggestions.map(item => <button key={item} onClick={() => { setInput(item); setAnswer(buildResponse(item, subject)); }}>{item}</button>)}</div>
    </section>
  </main>;
}
