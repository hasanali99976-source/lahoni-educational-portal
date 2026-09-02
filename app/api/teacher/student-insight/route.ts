import { generateText } from "ai";
import { NextResponse } from "next/server";
import { requireSession } from "../../../../lib/server/portal-auth";

type Dimension = { label?: unknown; value?: unknown };
type RepeatedNote = { label?: unknown; count?: unknown };
type InsightBody = {
  subject?: unknown;
  total?: unknown;
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
    const total = boundedNumber(body.total, 0, 105);
    const missing = Math.round(boundedNumber(body.missing, 0, 30));
    const weakest = {
      label: shortText(body.weakest?.label || "غير محدد", 60),
      value: boundedNumber(body.weakest?.value),
    };
    const strongest = {
      label: shortText(body.strongest?.label || "غير محدد", 60),
      value: boundedNumber(body.strongest?.value),
    };
    const repeatedNotes = (Array.isArray(body.repeatedNotes) ? body.repeatedNotes : [])
      .slice(0, 6)
      .map(item => ({ label: shortText(item.label, 80), count: Math.round(boundedNumber(item.count, 0, 50)) }))
      .filter(item => item.label && item.count > 0);

    const prompt = `أنت مساعد تربوي سعودي متخصص في تحليل أداء طلاب المرحلة الثانوية.\n\nحلل المؤشرات التالية لطالب مجهول الاسم في مادة ${subject}:\n- درجة الإتقان الحالية: ${total}%\n- عناصر الرصد غير المكتملة: ${missing}\n- أضعف محور: ${weakest.label} (${weakest.value}%)\n- أقوى محور: ${strongest.label} (${strongest.value}%)\n- الملاحظات المتكررة: ${repeatedNotes.length ? repeatedNotes.map(item => `${item.label} (${item.count} مرات)`).join("، ") : "لا توجد ملاحظات متكررة"}\n\nالمطلوب إخراج JSON فقط بلا Markdown بهذه المفاتيح العربية المحتوى والإنجليزية الاسم:\n{\n  "analysis": "تشخيص تربوي مختصر من جملة أو جملتين يشرح النمط الظاهر من البيانات دون أحكام شخصية",\n  "recommendedAction": "إجراء واحد عملي يمكن للمعلم تطبيقه في الحصة القادمة",\n  "suggestedNote": "ملاحظة مدرسية محترمة وواضحة تصلح للطالب وولي الأمر، تبدأ بعبارة الطالب أو أظهر الطالب، ولا تتجاوز 30 كلمة"\n}\n\nقواعد مهمة:\n- لا تذكر اسم طالب أو تفترض جنسًا أو حالة صحية أو نفسية أو عائلية.\n- لا تستخدم تشخيصات طبية أو نفسية.\n- لا تخترع أحداثًا لم تظهر في البيانات.\n- إذا كان الرصد ناقصًا، اذكر أن الحكم مبدئي.\n- اجعل اللغة مهنية، مباشرة، داعمة، وغير جارحة.`;

    const result = await generateText({
      model: "openai/gpt-5.6-luna",
      system: "أجب بالعربية فقط والتزم بصيغة JSON المطلوبة حرفيًا.",
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
    return NextResponse.json({
      ok: false,
      message: "تعذر الاتصال بالذكاء الاصطناعي الآن. الاقتراح الذكي المحلي ما زال متاحًا.",
    }, { status: 503 });
  }
}
