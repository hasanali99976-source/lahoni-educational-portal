"use client";
import { useState } from "react";
import "./ai-diagnostic-builder.css";

type GeneratedQuestion = { text: string; options: string[]; correctIndex: number; skill: string };

export default function AiDiagnosticBuilder({ subjectId, subjectName, onGenerated, onMessage }: { subjectId: string; subjectName: string; onGenerated: (questions: GeneratedQuestion[]) => void; onMessage: (message: string) => void }) {
  const [sourceType, setSourceType] = useState<"topic" | "file" | "url">("topic");
  const [topic, setTopic] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [conditions, setConditions] = useState("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState("متدرج");
  const [grade, setGrade] = useState("");
  const [loading, setLoading] = useState(false);
  const [manualAvailable, setManualAvailable] = useState(false);

  function continueManually() {
    const drafts = Array.from({ length: Math.min(30, Math.max(3, count)) }, () => ({
      text: "",
      options: ["", "", "", ""],
      correctIndex: 0,
      skill: "",
    }));
    onGenerated(drafts);
    onMessage(`تم تجهيز ${drafts.length} أسئلة فارغة. اكتب الأسئلة والخيارات ثم احفظ الاختبار أو انشره.`);
    requestAnimationFrame(() => document.getElementById("manual-diagnostic-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function generate() {
    const form = new FormData();
    form.set("subjectId", subjectId);
    form.set("sourceType", sourceType);
    form.set("topic", topic);
    form.set("url", url);
    form.set("conditions", conditions);
    form.set("count", String(count));
    form.set("difficulty", difficulty);
    form.set("grade", grade);
    if (file) form.set("file", file);
    setLoading(true);
    setManualAvailable(false);
    onMessage("جارٍ قراءة المصدر وإنشاء الاختبار…");
    try {
      const response = await fetch("/api/teacher/diagnostics/generate", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 503) {
          setManualAvailable(true);
          onMessage("التوليد الذكي غير متاح حاليًا، ويمكنك متابعة إنشاء الاختبار يدويًا دون تعطّل.");
          return;
        }
        onMessage(data.message || "تعذر إنشاء الاختبار.");
        return;
      }
      onGenerated(data.questions);
      onMessage(`تم إنشاء ${data.questions.length} أسئلة من ${subjectName}. راجعها قبل النشر.`);
    } catch {
      setManualAvailable(true);
      onMessage("تعذر الاتصال بخدمة التوليد الذكي، ويمكنك متابعة إنشاء الاختبار يدويًا.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="ai-test-builder"><header><div><span>✦ إنشاء ذكي</span><h2>أنشئ اختبارًا من محتواك</h2><p>ارفع ملفًا أو ضع رابطًا أو اكتب الموضوع، ثم حدد شروطك.</p></div></header><div className="source-tabs"><button className={sourceType === "topic" ? "active" : ""} onClick={() => setSourceType("topic")}>موضوع أو نص</button><button className={sourceType === "file" ? "active" : ""} onClick={() => setSourceType("file")}>رفع ملف</button><button className={sourceType === "url" ? "active" : ""} onClick={() => setSourceType("url")}>رابط</button></div>{sourceType === "topic" && <label>المحتوى المرجعي<textarea value={topic} onChange={event => setTopic(event.target.value)} placeholder="اكتب الوحدة أو الصق النص هنا…" /></label>}{sourceType === "file" && <label className="file-drop">الملف المرجعي<input type="file" accept=".pdf,.txt,.csv,.md,.json" onChange={event => setFile(event.target.files?.[0] || null)} /><small>{file?.name || "PDF أو ملف نصي — حتى ٨ ميجابايت"}</small></label>}{sourceType === "url" && <label>رابط المحتوى<input type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://" /></label>}<div className="generation-rules"><label>عدد الأسئلة<input type="number" min="3" max="30" value={count} onChange={event => setCount(Number(event.target.value))} /></label><label>الصعوبة<select value={difficulty} onChange={event => setDifficulty(event.target.value)}><option>سهل</option><option>متوسط</option><option>متدرج</option><option>متقدم</option></select></label><label>الصف<input value={grade} onChange={event => setGrade(event.target.value)} placeholder="أول ثانوي" /></label></div><label>شروط المعلم<textarea value={conditions} onChange={event => setConditions(event.target.value)} placeholder="ركّز على الفهم، ووزّع الأسئلة على المهارات…" /></label><div className="ai-builder-actions"><button className="generate-button" disabled={loading || !subjectId} onClick={generate}>{loading ? "جارٍ إنشاء الاختبار…" : "✦ إنشاء الأسئلة بالذكاء الاصطناعي"}</button>{manualAvailable && <button type="button" className="manual-fallback-button" onClick={continueManually}>متابعة يدويًا</button>}</div></section>;
}
