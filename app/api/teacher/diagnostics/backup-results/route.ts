import { NextResponse } from "next/server";
import { readDiagnosticBackups } from "../../../../../lib/server/diagnostic-backup";
import { requireSession } from "../../../../../lib/server/portal-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await requireSession("teacher");
  if (!session?.user?.active) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const subjectId = String(body?.subjectId || "");
  const diagnosticId = String(body?.diagnosticId || "");
  const studentIds = Array.isArray(body?.studentIds) ? body.studentIds.map(String) : [];
  if (!session.user.subjectIds.includes(subjectId)) return NextResponse.json({ ok: false }, { status: 403 });
  if (!diagnosticId || !studentIds.length) return NextResponse.json({ ok: true, results: [] });
  const values = await readDiagnosticBackups(session.userId, subjectId, diagnosticId, studentIds).catch(() => []);
  const results = values.map(result => ({ id: `${result.diagnosticId}__${result.studentId}`, ...result }));
  return NextResponse.json({ ok: true, results }, { headers: { "Cache-Control": "no-store" } });
}
