import { NextResponse } from "next/server";
import { findUserById, requireSession } from "../../../../../lib/server/portal-auth";
import { getSubjectConfig } from "../../../../../lib/subject-config";

export const runtime = "nodejs";
export const maxDuration = 60;

type StudentInput = {
  resultId: string;
  studentName: string;
  percentage: number;
  score: number;
  total: number;
  weakSkills: string[];
};

function validStudents(value: unknown): StudentInput[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 60).flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const resultId = String(row.resultId || "").trim();
    const studentName = String(row.studentName || "الطالب").trim().slice(0, 150);
    const percentage = Math.max(0, Math.min(100, Math.round(Number(row.percentage) || 0)));
    const score = Number(row.score) || 0;
    const total = Number(row.total) || 0;
    const weakSkills = Array.isArray(row.weakSkills) ? row.weakSkills.map(String).map(skill => skill.trim()).filter(Boolean).slice(0, 12) : [];
    return resultId ? [{ resultId, studentName, percentage, score, total, weakSkills }] : [];
  });
}

function validPlans(value: unknown, allowedIds: Set<string>) {
  if (!value || typeof value !== "object" || !Array.isArray((value as { plans?: unknown }).plans)) return [];
  const seen = new Set<string>();
  return (value as { plans: unknown[] }).plans.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const planItem = item as Record<string, unknown>;
    const resultId = String(planItem.resultId || "").trim();
    const plan = String(planItem.plan || "").trim();
    if (!allowedIds.has(resultId) || seen.has(resultId) || plan.length < 20) return [];
    seen.add(resultId);
    return [{ resultId, plan: plan.slice(0, 1400) }];
  });
}

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false, message: "انتهت جلسة المعلم، سجّل الدخول مجددًا." }, { status: 401 });
  const user = await findUserById(session.userId);
  if (!user?.active) return NextResponse.json({ ok: false, message: "الحساب غير متاح." }, { status: 403 });

  try {
    const body = await request.json();
    const subjectId = String(body?.subjectId || "");
    if (!user.subjectIds.includes(subjectId)) return NextResponse.json({ ok: false, message: "هذه المادة غير مخصصة لك." }, { status: 403 });
    const students = validStudents(body?.students);
    if (!students.length) return NextResponse.json({ ok: false, message: "لا توجد نتائج طلاب قابلة للتحليل." }, { status: 400 });
    const subjectName = String(body?.subjectName || getSubjectConfig(subjectId).label).slice(0, 120);
    const diagnosticTitle = String(body?.diagnosticTitle || "اختبار تشخيصي").slice(0, 200);
    const className = String(body?.className || "الفصل").slice(0, 80);
    const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    if (!token) return NextResponse.json({ ok: false, message: "ميزة الخطط الذكية تحتاج تفعيل AI Gateway في إعدادات البوابة." }, { status: 503 });

    const studentLines = students.map(student => JSON.stringify(student)).join("\n");
    const prompt = `أنت خبير تربوي سعودي. أنشئ خطة فردية دقيقة لكل طالب بناءً على نتيجة الاختبار التشخيصي.
المادة: ${subjectName}
الفصل: ${className}
الاختبار: ${diagnosticTitle}
التعليمات:
- أقل من 50٪: خطة علاجية مبسطة من 4 خطوات تشمل شرحًا وتدريبًا وواجبًا وإعادة قياس.
- من 50٪ إلى 79٪: خطة تحسين مركزة من 3 أو 4 خطوات.
- 80٪ فأعلى: خطة إثرائية مختصرة.
- اذكر المهارات الضعيفة المسجلة، ولا تخترع مهارات غير موجودة.
- اكتب بالعربية الواضحة وبصيغة مناسبة لعرضها للمعلم وولي الأمر.
- أعد resultId نفسه لكل طالب.
بيانات الطلاب، كل سطر JSON:
${studentLines}`;

    const gateway = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.REMEDIAL_AI_MODEL || process.env.DIAGNOSTIC_AI_MODEL || "openai/gpt-5.6-sol",
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "student_remedial_plans",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                plans: {
                  type: "array",
                  minItems: students.length,
                  maxItems: students.length,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: { resultId: { type: "string" }, plan: { type: "string" } },
                    required: ["resultId", "plan"],
                  },
                },
              },
              required: ["plans"],
            },
          },
        },
      }),
      signal: AbortSignal.timeout(50_000),
    });
    const responseData = await gateway.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } } | null;
    if (!gateway.ok) throw new Error(responseData?.error?.message || "ai_generation_failed");
    const raw = responseData?.choices?.[0]?.message?.content;
    const allowedIds = new Set(students.map(student => student.resultId));
    const plans = validPlans(raw ? JSON.parse(raw) : null, allowedIds);
    if (plans.length !== students.length) throw new Error("invalid_ai_plans");
    return NextResponse.json({ ok: true, plans });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ai_generation_failed";
    console.error("remedial plans generation failed", code);
    return NextResponse.json({ ok: false, message: code === "invalid_ai_plans" ? "لم تكتمل الخطط الذكية، حاول مرة أخرى." : "تعذر إنشاء الخطط الذكية الآن. حاول مرة أخرى." }, { status: 400 });
  }
}
