from pathlib import Path

route = Path('app/api/teacher/attendance/record/route.ts')
r = route.read_text()
needle = '''export async function DELETE(request: Request) {'''
patch = '''export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const ctx = await context(request, body); if ("error" in ctx) return ctx.error;
  const studentCode = clean(body.studentCode).toUpperCase();
  const status = body.status as AttendanceStatus;
  if (!studentCode || !VALID_STATUS.has(status)) return NextResponse.json({ ok: false, message: "حالة الطالب غير صحيحة." }, { status: 400 });
  const updatedAt = new Date().toISOString();
  try {
    await withTimeout(adminDb().runTransaction(async tx => {
      const snapshot = await tx.get(ctx.reference);
      const previous = snapshot.exists ? cleanRecords(snapshot.data()?.records) : {};
      const records = { ...previous, [studentCode]: status };
      tx.set(ctx.reference, { class: ctx.className, date: ctx.date, records, teacherId: ctx.session.userId, teacherName: ctx.session.name || "", subjectKey: ctx.subjectId, manualEdited: true, updatedAt, savedThroughApiAt: updatedAt }, { merge: true });
    }));
    return NextResponse.json({ ok: true, studentCode, status, updatedAt }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch { return NextResponse.json({ ok: false, message: "تعذر مزامنة حالة الطالب سحابيًا الآن." }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } }); }
}

export async function DELETE(request: Request) {'''
if needle not in r: raise SystemExit('route guard missing')
if 'export async function PATCH' not in r:
    r = r.replace(needle, patch, 1)
route.write_text(r)

page = Path('app/teacher/attendance/page.tsx')
p = page.read_text()
old = '''if(!payload.exists){if(local&&!deleted)useLocalFallback();return}'''
new = '''if(!payload.exists){setRecords(defaults);setHasSavedRecord(false);setMessage("");return}'''
if old not in p: raise SystemExit('cloud authority guard missing')
p = p.replace(old, new, 1)
old2 = '''function setStudentStatus(st:UnifiedStudent,status:AttendanceStatus){const next={...records,[studentCode(st)]:status};setRecords(next);setAttendanceDirty(true);persistLocal(next);setMessage("تم تحديث الحالة. اضغط حفظ الحضور لمزامنتها بين جميع الأجهزة.")}'''
new2 = '''function setStudentStatus(st:UnifiedStudent,status:AttendanceStatus){const code=studentCode(st),next={...records,[code]:status};setRecords(next);setAttendanceDirty(true);persistLocal(next);setMessage("جارٍ مزامنة حالة الطالب مع جميع الأجهزة...");void fetch("/api/teacher/attendance/record",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({subjectId:subjectKey,className:selectedClass,date:selectedDate,studentCode:code,status})}).then(async response=>{if(!response.ok)throw new Error("attendance_student_sync_failed");setAttendanceDirty(false);setHasSavedRecord(true);setMessage("تمت مزامنة حالة الطالب مباشرة مع الويب والجوال والتطبيق")}).catch(()=>{setMessage("تعذر المزامنة السحابية الآن؛ الحالة محفوظة مؤقتًا على هذا الجهاز.")})}'''
if old2 not in p: raise SystemExit('student status guard missing')
p = p.replace(old2, new2, 1)
page.write_text(p)
print('attendance single cloud source patch applied')
