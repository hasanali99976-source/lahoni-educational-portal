import { generateText } from "ai";
import { NextResponse } from "next/server";
import { requireSession } from "../../../../lib/server/portal-auth";

type Dimension = { label?: unknown; value?: unknown };
type RepeatedNote = { label?: unknown; count?: unknown };
type InsightBody = {
  subject?: unknown;
  performance?: unknown;
  completion?: unknown;
  missing?: unknown;
  weakest?: Dimension;
  strongest?: Dimension;
  repeatedNotes?: RepeatedNote[];
};

function boundedNumber(value: unknown, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function shortText(value: unknown, max = 80) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

function parseJsonText(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    throw new Error("invalid_ai_json");
  }
}

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false, message: "غير مصرح" }, { status: 401 });

  try {
    const body = await request.json() as InsightBody;
    const subject = shortText(body.subject || "المادة", 50);
    const performance = boundedNumber(body.performance);
    const completion = boundedNumber(body.completion);
    const missing = Math.round(boundedNumber(body.missing, 0, 30));
    const weakest = { label: shortText(body.weakest?.label || "غير محدد", 60), value: boundedNumber(body.weakest?.value) };
    const strongest = { label: shortText(body.strongest?.label || "غير محدد", 60), value: boundedNumber(body.strongest?.value) };
    const repeatedNotes = (Array.isArray(body.repeatedNotes) ? body.repeatedNotes : [])
      .slice(0, 5)
      .map(item => ({ label: shortText(item.label, 90), count: Math.round(boundedNumber(item.count, 0, 50)) }))
      .filter(item => item.label && item.count > 0);

    const prompt = `أنت مساعد تربوي سعودي يساعد المعلم على قراءة مؤشرات طالب في المرحلة الثانوية. اسم الطالب غير مُرسل إليك.\n\nالمادة: ${subject}\nالأداء في العناصر التي تم رصدها فقط: ${performance}%\nنسبة اكتمال الرصد: ${completion}%\nعدد العناصر غير المرصودة: ${missing}\nأضعف محور مرصود: ${weakest.label} (${weakest.value}%)\nأقوى محور مرصود: ${strongest.label} (${strongest.value}%)\nالملاحظات المتكررة: ${repeatedNotes.length ? repeatedNotes.map(item => `${item.label} (${item.count} مرات)`).join("، ") : "لا توجد"}\n\nأخرج JSON فقط بهذه المفاتيح:\n{\n  "analysis": "قراءة تربوية قصيرة تفرق بوضوح بين ضعف الأداء وبين نقص الرصد",\n  "recommendedAction": "إجراء واحد محدد للمعلم في الحصة القادمة",\n  "suggestedNote": "ملاحظة مدرسية محترمة وواضحة تبدأ بكلمة الطالب، وتصلح للطالب وولي الأمر"\n}\n\nقواعد:\n- إذا كان اكتمال الرصد أقل من 100% فلا تصف الطالب بأنه ضعيف أو متعثر بشكل نهائي، بل قل إن القراءة مبدئية.\n- لا تخترع سببًا نفسيًا أو صحيًا أو عائليًا.\n- لا تذكر اسم طالب أو معلومات شخصية.\n- لا تتجاوز الملاحظة المقترحة 30 كلمة.\n- استخدم العربية المهنية المباشرة.`;

    const result = await generateText({
      model: "openai/gpt-5.4",
      system: "أجب بالعربية فقط، وأعد JSON صالحًا دون Markdown أو شرح إضافي.",
      prompt,
    });
    const parsed = parseJsonText(result.text);
    const analysis = shortText(parsed.analysis, 420);
    const recommendedAction = shortText(parsed.recommendedAction, 320);
    const suggestedNote = shortText(parsed.suggestedNote, 260);
    if (!analysis || !recommendedAction || !suggestedNote) throw new Error("incomplete_ai_response");
    return NextResponse.json({ ok: true, analysis, recommendedAction, suggestedNote });
  } catch (error) {
    console.error("student-insight-ai", error);
    return NextResponse.json({ ok: false, message: "تعذر تشغيل التحليل بالذكاء الاصطناعي الآن. جرّب مرة أخرى بعد قليل." }, { status: 503 });
  }
}
