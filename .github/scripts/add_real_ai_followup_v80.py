from pathlib import Path

path = Path("app/teacher/follow-up/page.tsx")
text = path.read_text(encoding="utf-8")

old_type = 'type RankedStudent = Student & { total: number; missing: number };\n'
new_type = old_type + 'type AiInsight = { analysis: string; recommendedAction: string; suggestedNote: string };\n'
if old_type not in text:
    raise SystemExit("RankedStudent type anchor missing")
text = text.replace(old_type, new_type, 1)

old_state = '  const [noteStudent, setNoteStudent] = useState<Student | null>(null), [selectedNoteTypes, setSelectedNoteTypes] = useState<string[]>([]), [note, setNote] = useState(""), [message, setMessage] = useState("");\n'
new_state = old_state + '  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null), [aiLoading, setAiLoading] = useState(false);\n'
if old_state not in text:
    raise SystemExit("note state anchor missing")
text = text.replace(old_state, new_state, 1)

save_anchor = '  async function saveNote() {\n'
ai_function = '''  async function requestAiInsight() {
    if (!noteStudent || aiLoading) return;
    const smart = smartStudentProfile(noteStudent);
    const repeatedNotes = Object.entries(noteStudent.teacherNoteCounts || {})
      .filter(([, count]) => Number(count) > 0)
      .map(([type, count]) => ({ label: noteOptions.find(option => option.type === type)?.label || type, count: Number(count) }));
    setAiLoading(true);
    setAiInsight(null);
    try {
      const response = await fetch("/api/teacher/student-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          total: smart.total,
          missing: smart.missing,
          weakest: { label: smart.weakest.label, value: smart.weakest.value },
          strongest: { label: smart.strongest.label, value: smart.strongest.value },
          repeatedNotes,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.message || "تعذر تحليل البيانات بالذكاء الاصطناعي.");
      setAiInsight({ analysis: String(data.analysis || ""), recommendedAction: String(data.recommendedAction || ""), suggestedNote: String(data.suggestedNote || "") });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر الاتصال بالذكاء الاصطناعي الآن.");
    } finally {
      setAiLoading(false);
    }
  }
'''
if save_anchor not in text:
    raise SystemExit("saveNote anchor missing")
text = text.replace(save_anchor, ai_function + save_anchor, 1)

open_old = 'setNoteStudent(student); setSelectedNoteTypes([]); setNote("");'
open_new = 'setNoteStudent(student); setSelectedNoteTypes([]); setNote(""); setAiInsight(null);'
if open_old not in text:
    raise SystemExit("note open anchor missing")
text = text.replace(open_old, open_new)

old_ai_block = '<p>{smart.recommendation}</p><button type="button" className="note-ai-suggest" onClick={() => { setSelectedNoteTypes(current => current.includes(suggestedType) ? current : [...current, suggestedType]); }}>اختيار الملاحظة المقترحة تلقائيًا</button>'
new_ai_block = '''<p>{smart.recommendation}</p><div className="note-ai-actions"><button type="button" className="note-ai-suggest" onClick={() => { setSelectedNoteTypes(current => current.includes(suggestedType) ? current : [...current, suggestedType]); }}>اقتراح سريع من بيانات الطالب</button><button type="button" className="note-ai-generate" onClick={() => void requestAiInsight()} disabled={aiLoading}>{aiLoading ? "جاري تحليل البيانات بالذكاء الاصطناعي..." : "✦ تحليل وصياغة بالذكاء الاصطناعي"}</button></div>{aiInsight && <div className="note-ai-result"><div><small>تحليل AI</small><strong>{aiInsight.analysis}</strong></div><div><small>الإجراء المقترح</small><p>{aiInsight.recommendedAction}</p></div><div className="note-ai-ready"><small>ملاحظة جاهزة للطالب وولي الأمر</small><p>{aiInsight.suggestedNote}</p><button type="button" onClick={() => { setSelectedNoteTypes(current => current.includes("other") ? current : [...current, "other"]); setNote(aiInsight.suggestedNote); }}>استخدام هذه الصياغة كملاحظة مخصصة</button></div></div>}'''
if old_ai_block not in text:
    raise SystemExit("AI card block anchor missing")
text = text.replace(old_ai_block, new_ai_block, 1)

path.write_text(text, encoding="utf-8")

css_path = Path("app/teacher/follow-up/follow-up.css")
css = css_path.read_text(encoding="utf-8")
css += '''\n/* v80 — real generative AI result */\n.note-ai-actions{display:flex;flex-wrap:wrap;gap:7px}.note-ai-generate{border:0;border-radius:10px;padding:8px 12px;background:linear-gradient(135deg,#6b45d8,#315ac8);color:#fff;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.note-ai-generate:disabled{opacity:.65;cursor:wait}.note-ai-result{display:grid;gap:8px;margin-top:11px;padding:11px;border:1px solid #cfc5f4;border-radius:13px;background:linear-gradient(145deg,#faf8ff,#f2f6ff)}.note-ai-result>div{padding:8px 9px;border-radius:10px;background:#fff;border:1px solid #e5e3f2}.note-ai-result small{display:block;color:#6547ba;font-size:9px;font-weight:900;margin-bottom:3px}.note-ai-result strong,.note-ai-result p{margin:0;color:#344254;font-size:11px;line-height:1.65}.note-ai-ready{border-color:#c5e6da!important;background:#f7fffb!important}.note-ai-ready button{margin-top:7px;border:0;border-radius:9px;padding:7px 10px;background:#08745a;color:#fff;font:inherit;font-size:10px;font-weight:900;cursor:pointer}\n'''
css_path.write_text(css, encoding="utf-8")

sw_path = Path("public/sw.js")
sw = sw_path.read_text(encoding="utf-8").replace("ostadh-lahooni-v79-one-page-smart-mastery", "ostadh-lahooni-v80-real-ai-mastery")
sw_path.write_text(sw, encoding="utf-8")
print("v80 AI UI patch applied")
