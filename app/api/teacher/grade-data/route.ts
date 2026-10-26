import { revalidateTag, unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import { SCHOOL_STUDENTS_COLLECTION, normalizeStudentRecord } from "../../../../lib/school-roster";

function clean(value: unknown, limit = 100) { return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit); }
function assigned(session: NonNullable<Awaited<ReturnType<typeof requireSession>>>, subjectId:string) { return Boolean(session.user && /^[a-z0-9_-]+$/i.test(subjectId) && normalizeAssignments(session.user.assignments, session.user.subjectIds).some(item => item.subjectId === subjectId)); }
function archived(value: Record<string, unknown>) { return value.deleted === true || value.archived === true || Boolean(value.deletedAt) || Boolean(value.archivedAt) || String(value.status || "").toLowerCase() === "archived"; }
async function readLiveGradeData(teacherId:string,subjectId:string){
  const snapshot=await adminDb().collection(`portalV2Data/${teacherId}/subjects/${subjectId}/students`).get();
  const grouped=new Map<string,Array<{id:string;data:Record<string,unknown>}>>();
  snapshot.docs.forEach(item=>{
    const data=item.data() as Record<string,unknown>;
    if(archived(data))return;
    const code=clean(data.code||data.accessCode||data.studentCode||item.id,40).toUpperCase();
    if(!code)return;
    const rows=grouped.get(code)||[];
    rows.push({id:item.id,data});
    grouped.set(code,rows);
  });
  const byCode:Record<string,Record<string,unknown>>={};
  grouped.forEach((rows,code)=>{
    // Older student documents may hold real grades while a newly synced barcode
    // document contains only identity. Merge assessment fields without replacing
    // recorded marks with blank values from the newer document.
    rows.sort((a,b)=>String(a.data.updatedAt||"").localeCompare(String(b.data.updatedAt||"")));
    const merged:Record<string,unknown>={};
    for(const row of rows){
      const previousValues=merged.gradeValues&&typeof merged.gradeValues==="object"?merged.gradeValues as Record<string,unknown>:{};
      const previousPlans=merged.gradePlanValues&&typeof merged.gradePlanValues==="object"?merged.gradePlanValues as Record<string,unknown>:{};
      Object.assign(merged,row.data);
      merged.gradeValues=previousValues;
      merged.gradePlanValues=previousPlans;
      for(const field of ["gradeValues","gradePlanValues"]){
        const source=row.data[field];
        if(!source||typeof source!=="object"||Array.isArray(source))continue;
        const current=merged[field]&&typeof merged[field]==="object"?merged[field] as Record<string,unknown>:{};
        merged[field]={...current,...source as Record<string,unknown>};
      }
    }
    const canonical=rows.find(row=>row.id.toUpperCase()===code);
    byCode[code]={...merged,documentId:canonical?.id||rows[rows.length-1]!.id,code};
  });
  return byCode;
}
const readGradeData = unstable_cache(readLiveGradeData,["teacher-grade-data-v3"],{revalidate:3600,tags:["teacher-grade-data"]});
export async function GET(request:Request){const session=await requireSession("teacher");if(!session)return NextResponse.json({ok:false},{status:401});try{const url=new URL(request.url),subjectId=clean(url.searchParams.get("subjectId"),80);if(!assigned(session,subjectId))return NextResponse.json({ok:false,message:"هذه المادة غير مسندة إلى حسابك."},{status:403});const fresh=url.searchParams.get("fresh")==="1";const byCode=await (fresh?readLiveGradeData(session.userId,subjectId):readGradeData(session.userId,subjectId));return NextResponse.json({ok:true,byCode},{headers:{"Cache-Control":fresh?"no-store":"private, max-age=60, stale-while-revalidate=300"}})}catch(error){console.error("teacher grade data failed",error);return NextResponse.json({ok:false,message:"تعذر تحميل بيانات التحصيل المحفوظة."},{status:500})}}
export async function POST(request:Request){const session=await requireSession("teacher");if(!session)return NextResponse.json({ok:false},{status:401});try{const body=await request.json() as Record<string,unknown>,subjectId=clean(body.subjectId,80),rows=Array.isArray(body.rows)?body.rows:[];if(!assigned(session,subjectId))return NextResponse.json({ok:false,message:"هذه المادة غير مسندة إلى حسابك."},{status:403});if(!rows.length)return NextResponse.json({ok:false,message:"لا توجد درجات للحفظ."},{status:400});if(rows.length>100)return NextResponse.json({ok:false,message:"عدد السجلات أكبر من الحد المسموح."},{status:400});const validCodes=[...new Set(rows.map((row:Record<string,unknown>)=>clean(row?.code||row?.id,40).toUpperCase()).filter(Boolean))];const officialDocs=await adminDb().getAll(...validCodes.map((code:string)=>adminDb().collection(SCHOOL_STUDENTS_COLLECTION).doc(code)));const activeCodes=new Set(officialDocs.filter(doc=>doc.exists&&normalizeStudentRecord(doc.data() as Record<string,unknown>,doc.id)?.active!==false).map(doc=>doc.id.toUpperCase()));if(validCodes.some((code:string)=>!activeCodes.has(code)))return NextResponse.json({ok:false,message:"تحتوي عملية الحفظ على طالب محذوف أو غير موجود في قائمة الإدارة. حدّث قائمة الطلاب أولًا."},{status:409});const batch=adminDb().batch(),root=`portalV2Data/${session.userId}/subjects/${subjectId}/students`,now=new Date().toISOString();let saved=0;for(const raw of rows){if(!raw||typeof raw!=="object")continue;const row=raw as Record<string,unknown>,code=clean(row.code||row.id,40).toUpperCase();if(!code)continue;const ref=adminDb().collection(root).doc(code),payload:Record<string,unknown>={name:clean(row.name,160),class:clean(row.className||row.class,80),className:clean(row.className||row.class,80),code,active:true,rosterActive:true,teacherId:session.userId,subjectKey:subjectId,updatedAt:now};for(const key of ["gradeValues","gradePlanValues","activeGradePlanId","activeGradePlanVersion","gradePlanUpdatedAt","gradeDeductions","gradeDeductionUpdatedAt"]){if(row[key]!==undefined)payload[key]=row[key]}batch.set(ref,payload,{merge:true});saved++}if(!saved)return NextResponse.json({ok:false,message:"لم يتم العثور على سجلات صالحة للحفظ."},{status:400});await batch.commit();revalidateTag("teacher-grade-data","max");return NextResponse.json({ok:true,saved,updatedAt:now})}catch(error){console.error("teacher grade save failed",error);return NextResponse.json({ok:false,message:"تعذر حفظ رصد الدرجات الآن."},{status:500})}}