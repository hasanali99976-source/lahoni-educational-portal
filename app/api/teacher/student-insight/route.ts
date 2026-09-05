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

function localInsight(input: {
  performance: number;
  completion: number;
  missing: number;
  weakest: { label: string; value: number };
  strongest: { label: string; value: number };
  repeatedNotes: Array<{ label: string; count: number }>;
}) {
  const { performance, completion, missing, weakest, strongest, repeatedNotes } = input;
  const incomplete = completion < 100;
  const repeated = repeatedNotes.sort((a, b) => b.count - a.count)[0];

  const analysis = incomplete
    ? `القراءة مبدئية لأن الرصد مكتمل بنسبة ${Math.round(completion)}% فقط${missing ? `، وما زال ${missing} عنصرًا غير مرصود` : ""}. أقوى مؤشر مرصود حاليًا هو ${strongest.label} (${Math.round(strongest.value)}%)، وأقل مؤشر هو ${weakest.label} (${Math.round(weakest.value)}%). لا يصدر حكم نهائي على مستوى الطالب قبل اكتمال الرصد.`
    : performance >= 80
      ? `الرصد مكتمل، والأداء العام في المستوى الجيد (${Math.round(performance)}%). يظهر تميز أكبر في ${strongest.label}، بينما يبقى ${weakest.label} أفضل نقطة للتركيز عليها للحفاظ على التوازن في الأداء.`
      : `الرصد مكتمل، ويحتاج الأداء الحالي (${Math.round(performance)}%) إلى تدخل تعليمي محدد. أقل محور مرصود هو ${weakest.label} (${Math.round(weakest.value)}%)، بينما يمثل ${strongest.label} نقطة قوة يمكن البناء عليها.`;

  const recommendedAction = incomplete
    ? `استكمل العناصر غير المرصودة أولًا، ثم أعد قراءة النتيجة قبل اتخاذ قرار علاجي أو إثرائي.`
    : performance >= 80
      ? `قدّم نشاطًا قصيرًا يركز على ${weakest.label} مع المحافظة على تعزيز ${strongest.label}.`
      : `خصص في الحصة القادمة تدريبًا قصيرًا ومباشرًا على ${weakest.label}، ثم تحقق من الفهم بسؤال أو مهمة سريعة.`;

  const suggestedNote = incomplete
    ? `الطالب ما زال في مرحلة استكمال الرصد، وستتضح صورة أدائه بدقة أكبر بعد اكتمال جميع عناصر التقييم.`
    : performance >= 80
      ? `الطالب يحقق أداءً جيدًا، ونوصي بمواصلة التركيز على ${weakest.label} لتعزيز تقدمه والمحافظة على مستوى متوازن.`
      : repeated
        ? `الطالب يحتاج إلى دعم إضافي في ${weakest.label}، مع متابعة ${repeated.label} والعمل على تحسينها تدريجيًا.`
        : `الطالب يحتاج إلى دعم إضافي في ${weakest.label}، وسيتم متابعته من خلال تدريب موجه والتحقق من تقدمه.`;

  return { analysis, recommendedAction, suggestedNote };
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

    const fallback = localInsight({ performance, completion, missing, weakest, strongest, repeatedNotes });
    const prompt = `أنت مساعد تربوي سعودي يساعد المعلم على قراءة مؤشرات طالب في المرحلة الثانوية. اسم الطالب غير مُرسل إليك.\n\nالمادة: ${subject}\nالأداء في العناصر التي تم رصدها فقط: ${performance}%\nنسبة اكتمال الرصد: ${completion}%\nعدد العناصر غير المرصودة: ${missing}\nأضعف محور مرصود: ${weakest.label} (${weakest.value}%)\nأقوى محور مرصود: ${strongest.label} (${strongest.value}%)\nالملاحظات المتكررة: ${repeatedNotes.length ? repeatedNotes.map(item => `${item.label} (${item.count} مرات)`).join("، ") : "لا توجد"}\n\nأخرج JSON فقط بهذه المفاتيح:\n{\n  "analysis": "قراءة تربوية قصيرة تفرق بوضوح بين ضعف الأداء وبين نقص الرصد",\n  "recommendedAction": "إجراء واحد محدد للمعلم في الحصة القادمة",\n  "suggestedNote": "ملاحظة مدرسية محترمة وواضحة تبدأ بكلمة الطالب، وتصلح للطالب وولي الأمر"\n}\n\nقواعد:\n- إذا كان اكتمال الرصد أقل من 100% فلا تصف الطالب بأنه ضعيف أو متعثر بشكل نهائي، بل قل إن القراءة مبدئية.\n- لا تخترع سببًا نفسيًا أو صحيًا أو عائليًا.\n- لا تذكر اسم طالب أو معلومات شخصية.\n- لا تتجاوز الملاحظة المقترحة 30 كلمة.\n- استخدم العربية المهنية المباشرة.`;

    try {
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
      return NextResponse.json({ ok: true, analysis, recommendedAction, suggestedNote, source: "ai" });
    } catch (error) {
      console.warn("student-insight-ai-fallback", error instanceof Error ? error.message : "ai_unavailable");
      return NextResponse.json({ ok: true, ...fallback, source: "local-fallback" });
    }
  } catch (error) {
    console.error("student-insight-request", error);
    return NextResponse.json({ ok: false, message: "تعذر قراءة مؤشرات الطالب الآن." }, { status: 400 });
  }
}
