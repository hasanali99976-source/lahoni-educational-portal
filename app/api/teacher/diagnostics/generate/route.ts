import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { findUserById, requireSession } from "../../../../../lib/server/portal-auth";
import { getSubjectConfig } from "../../../../../lib/subject-config";

export const runtime = "nodejs";
export const maxDuration = 60;

type GeneratedQuestion = { text: string; options: string[]; correctIndex: number; skill: string };

function privateAddress(address: string) {
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  if (!isIP(address) || address.includes(":")) return false;
  const [a, b] = address.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

async function readPublicUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("invalid_url");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(item => privateAddress(item.address))) throw new Error("private_url");
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(12_000), headers: { "User-Agent": "Lahooni-Education-Portal/1.0" } });
  if (!response.ok) throw new Error("url_fetch_failed");
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/") && !contentType.includes("json")) throw new Error("url_not_text");
  return (await response.text()).slice(0, 60_000);
}

function validQuestions(value: unknown): GeneratedQuestion[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { questions?: unknown }).questions)) return [];
  return (value as { questions: unknown[] }).questions.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const q = item as Record<string, unknown>;
    const options = Array.isArray(q.options) ? q.options.map(String).map(value => value.trim()) : [];
    const correctIndex = Number(q.correctIndex);
    if (!String(q.text || "").trim() || options.length !== 4 || options.some(value => !value) || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) return [];
    return [{ text: String(q.text).trim(), options, correctIndex, skill: String(q.skill || "مهارة عامة").trim() }];
  });
}

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session) return NextResponse.json({ ok: false, message: "انتهت جلسة المعلم، سجّل الدخول مجددًا." }, { status: 401 });
  const user = await findUserById(session.userId);
  if (!user?.active) return NextResponse.json({ ok: false, message: "الحساب غير متاح." }, { status: 403 });

  try {
    const form = await request.formData();
    const subjectId = String(form.get("subjectId") || "");
    if (!user.subjectIds.includes(subjectId)) return NextResponse.json({ ok: false, message: "هذه المادة غير مخصصة لك." }, { status: 403 });
    const sourceType = String(form.get("sourceType") || "topic");
    const topic = String(form.get("topic") || "").trim().slice(0, 60_000);
    const conditions = String(form.get("conditions") || "").trim().slice(0, 2_000);
    const count = Math.min(30, Math.max(3, Number(form.get("count")) || 10));
    const difficulty = String(form.get("difficulty") || "متوسط");
    const grade = String(form.get("grade") || "").slice(0, 100);
    const file = form.get("file");
    let sourceText = topic;
    let filePart: Record<string, unknown> | null = null;

    if (sourceType === "url") sourceText = await readPublicUrl(String(form.get("url") || ""));
    if (sourceType === "file") {
      if (!(file instanceof File) || !file.size) throw new Error("missing_file");
      if (file.size > 8 * 1024 * 1024) throw new Error("file_too_large");
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (["txt", "md", "csv", "json"].includes(extension || "")) sourceText = (await file.text()).slice(0, 60_000);
      else if (extension === "pdf" && file.type === "application/pdf") {
        const encoded = Buffer.from(await file.arrayBuffer()).toString("base64");
        filePart = { type: "file", file: { filename: file.name, file_data: `data:application/pdf;base64,${encoded}` } };
        sourceText = "اعتمد على ملف PDF المرفق فقط.";
      } else throw new Error("unsupported_file");
    }
    if (!sourceText.trim() && !filePart) throw new Error("missing_source");

    const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    if (!token) return NextResponse.json({ ok: false, message: "ميزة التوليد الذكي تحتاج تفعيل مفتاح AI Gateway في إعدادات البوابة." }, { status: 503 });
    const subject = getSubjectConfig(subjectId).label;
    const prompt = `أنشئ اختبارًا تشخيصيًا عربيًا دقيقًا لمادة ${subject}${grade ? ` للصف ${grade}` : ""}.
عدد الأسئلة: ${count}. المستوى: ${difficulty}. النوع: اختيار من متعدد.
شروط المعلم: ${conditions || "قياس الفهم والمهارات الأساسية دون أسئلة خادعة"}.
اعتمد حصراً على المصدر، واكتب أربعة خيارات واضحة وإجابة صحيحة واحدة ومهارة قصيرة لكل سؤال.
المصدر:\n${sourceText}`;
    const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
    if (filePart) content.push(filePart);
    const gateway = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.DIAGNOSTIC_AI_MODEL || "openai/gpt-5.6-sol", messages: [{ role: "user", content }], response_format: { type: "json_schema", json_schema: { name: "diagnostic_test", strict: true, schema: { type: "object", additionalProperties: false, properties: { questions: { type: "array", minItems: count, maxItems: count, items: { type: "object", additionalProperties: false, properties: { text: { type: "string" }, options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } }, correctIndex: { type: "integer", minimum: 0, maximum: 3 }, skill: { type: "string" } }, required: ["text", "options", "correctIndex", "skill"] } } }, required: ["questions"] } } } }),
      signal: AbortSignal.timeout(50_000),
    });
    const result = await gateway.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } } | null;
    if (!gateway.ok) throw new Error(result?.error?.message || "generation_failed");
    const raw = result?.choices?.[0]?.message?.content;
    const questions = validQuestions(raw ? JSON.parse(raw) : null).slice(0, count);
    if (questions.length !== count) throw new Error("invalid_generation");
    return NextResponse.json({ ok: true, questions });
  } catch (error) {
    const code = error instanceof Error ? error.message : "generation_failed";
    const messages: Record<string, string> = { invalid_url: "الرابط غير صالح.", private_url: "لا يمكن استخدام رابط داخلي أو خاص.", url_fetch_failed: "تعذر فتح الرابط. تأكد أنه متاح للعامة.", url_not_text: "الرابط لا يحتوي صفحة نصية قابلة للقراءة.", missing_file: "اختر ملفًا أولًا.", file_too_large: "حجم الملف أكبر من ٨ ميجابايت.", unsupported_file: "الملفات المدعومة: PDF وTXT وCSV وMD وJSON.", missing_source: "اكتب موضوع الاختبار أو أرفق مصدرًا.", invalid_generation: "لم يكتمل توليد الأسئلة، حاول مرة أخرى." };
    console.error("diagnostic generation failed", code);
    return NextResponse.json({ ok: false, message: messages[code] || "تعذر إنشاء الاختبار الآن. حاول مرة أخرى." }, { status: 400 });
  }
}
