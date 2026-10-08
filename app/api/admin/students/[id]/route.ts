import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../../lib/server/portal-auth";
import { SCHOOL_CLASSES_COLLECTION, SCHOOL_STUDENTS_COLLECTION, canonicalClassName, classId, gradeNumber, schoolStage, sectionNumber } from "../../../../../lib/school-roster";

function refreshOfficialRoster(){revalidateTag("teacher-central-roster",{expire:0});}

function normalizedCode(value: unknown){return String(value||"").trim().toUpperCase();}

async function findTeacherStudentCopies(studentId:string,studentData:Record<string,unknown>){
  const db=adminDb();
  const paths=new Map<string,FirebaseFirestore.QueryDocumentSnapshot>();
  const codes=new Set([studentId,studentData.code,studentData.accessCode,studentData.studentCode].map(normalizedCode).filter(Boolean));
  for(const field of ["code","accessCode","studentCode"] as const){
    for(const code of codes){
      const snapshot=await db.collectionGroup("students").where(field,"==",code).get();
      snapshot.docs.forEach(document=>{const path=String(document.ref.path||"");if(path.startsWith("portalV2Data/"))paths.set(path,document);});
    }
  }
  return [...paths.values()];
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { id } = await context.params; const reference = adminDb().collection(SCHOOL_STUDENTS_COLLECTION).doc(id); const previous = await reference.get();
    if (!previous.exists) return NextResponse.json({ ok: false, message: "الطالب غير موجود" }, { status: 404 });
    const current = previous.data() as Record<string, unknown>; const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.replace(/\s+/g, " ").trim() : String(current.name || "");
    const stage = schoolStage(body?.stage ?? current.stage, current.className); const grade = gradeNumber(body?.grade ?? current.grade ?? current.className); const section = sectionNumber(body?.section ?? current.section, current.className);
    if (name.length < 3 || !grade || !section) return NextResponse.json({ ok: false, message: "أكمل اسم الطالب والصف والفصل" }, { status: 400 });
    const oldStage = schoolStage(current.stage, current.className); const oldGrade = gradeNumber(current.grade ?? current.className); const oldSection = sectionNumber(current.section, current.className); const moved = oldStage !== stage || oldGrade !== grade || oldSection !== section;
    const now = new Date().toISOString(); const className = canonicalClassName(grade, section, stage);
    await reference.set({name,stage,grade,section,className,active:body?.active===false?false:true,updatedAt:now,transferredAt:moved?now:current.transferredAt||null},{merge:true});
    await adminDb().collection(SCHOOL_CLASSES_COLLECTION).doc(classId(grade,section,stage)).set({stage,grade,section,name:className,active:true,updatedAt:now,createdAt:now},{merge:true});

    // Teacher class copies are historical snapshots. On a transfer, never let a stale copy
    // keep the student inside the old class report. We keep all recorded fields intact and
    // only detach that snapshot from roster/report membership. The new class is supplied by
    // the central official roster, so there is no duplicate write and no polling/read loop.
    let detachedTeacherCopies=0;
    if(moved){
      try{
        const copies=await findTeacherStudentCopies(id,current);
        const stale=copies.filter(document=>{
          const data=document.data() as Record<string,unknown>;
          const copyGrade=gradeNumber(data.grade??data.className);
          const copySection=sectionNumber(data.section,data.className);
          return (copyGrade===oldGrade&&copySection===oldSection)||(copyGrade!==grade||copySection!==section);
        });
        for(let index=0;index<stale.length;index+=400){
          const batch=adminDb().batch();
          stale.slice(index,index+400).forEach(document=>batch.set(document.ref,{
            rosterActive:false,
            transferred:true,
            transferredAt:now,
            transferredFrom:oldGrade&&oldSection?canonicalClassName(oldGrade,oldSection,oldStage):String(current.className||""),
            transferredTo:className,
            updatedAt:now
          },{merge:true}));
          await batch.commit();
        }
        detachedTeacherCopies=stale.length;
      }catch(cascadeError){
        console.error("teacher student transfer sync failed",cascadeError);
        return NextResponse.json({ok:false,message:"تم تحديد الفصل الجديد، لكن تعذر تحديث ارتباط سجلات الطالب. لم يتم حذف أي بيانات؛ أعد المحاولة."},{status:500});
      }
    }
    refreshOfficialRoster();
    return NextResponse.json({ ok: true, moved, className, detachedTeacherCopies });
  } catch (error) { console.error("update student failed", error); return NextResponse.json({ ok: false, message: "تعذر حفظ تعديل الطالب" }, { status: 500 }); }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!await requireSession("admin")) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { id } = await context.params; const reference = adminDb().collection(SCHOOL_STUDENTS_COLLECTION).doc(id); const snapshot = await reference.get();
    if (!snapshot.exists) return NextResponse.json({ ok: false, message: "الطالب غير موجود" }, { status: 404 });
    const studentData = snapshot.data() as Record<string, unknown>; const studentCode = String(studentData.code || studentData.accessCode || studentData.studentCode || id).trim().toUpperCase(); const now = new Date().toISOString();
    await reference.set({ active: false, archivedAt: now, updatedAt: now }, { merge: true });
    // Do not scan the students collection group here. On this project those queries require
    // indexes that are intentionally absent, so every admin archive was issuing three doomed
    // Firestore queries. The official roster archive above remains authoritative and no
    // teacher/student history is deleted or rewritten.
    const archivedTeacherCopies = 0;
    refreshOfficialRoster();
    return NextResponse.json({ ok: true, archivedTeacherCopies });
  } catch(error){console.error("archive student failed",error);return NextResponse.json({ok:false,message:"تعذر حذف الطالب"},{status:500});}
}

export async function POST(request: Request, context: {params: Promise<{id:string}>}){
  if(!await requireSession("admin"))return NextResponse.json({ok:false},{status:401});
  try{
    const {id}=await context.params;
    const code=normalizedCode(id);
    if(!/^(TH|MT)[123][0-9]{3}$/.test(code))return NextResponse.json({ok:false,message:"كود الطالب غير صالح"},{status:400});
    const body=await request.json().catch(()=>({}));
    if(body?.action!=="restore")return NextResponse.json({ok:false,message:"إجراء غير معروف"},{status:400});
    const ref=adminDb().collection(SCHOOL_STUDENTS_COLLECTION).doc(code);
    const snap=await ref.get();
    if(!snap.exists)return NextResponse.json({ok:false,message:"لم يُعثر على سجل الطالب الأصلي؛ لم تُنشأ أي بيانات جديدة"},{status:404});
    const data=snap.data() as Record<string,unknown>;
    const name=String(data.name||"").replace(/\s+/g," ").trim();
    if(body?.expectedName&&name!==String(body.expectedName).replace(/\s+/g," ").trim())return NextResponse.json({ok:false,message:"الاسم لا يطابق السجل الأصلي؛ لم تُجرَ أي تغييرات"},{status:409});
    const stage=schoolStage(data.stage,data.className);
    if((stage==="secondary"?"TH":"MT")!==code.slice(0,2))return NextResponse.json({ok:false,message:"تعارض في المرحلة؛ لم تُجرَ أي تغييرات"},{status:409});
    if(data.active!==false)return NextResponse.json({ok:true,alreadyActive:true,name,code,className:data.className});
    await ref.set({active:true,rosterActive:true,archivedAt:null,updatedAt:new Date().toISOString()},{merge:true});
    revalidateTag("admin-school-roster",{expire:0});
    refreshOfficialRoster();
    return NextResponse.json({ok:true,restored:true,name,code,className:data.className});
  }catch(error){console.error("restore archived student failed",error);return NextResponse.json({ok:false,message:"تعذرت استعادة الطالب"},{status:500})}
}
