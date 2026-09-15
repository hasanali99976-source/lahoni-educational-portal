import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";
import { SCHOOL_CLASSES_COLLECTION, SCHOOL_STUDENTS_COLLECTION, canonicalClassName, classId, gradeNumber, normalizeClassRecord, normalizeStudentRecord, type SchoolClass, type SchoolStudent } from "../../../../lib/school-roster";
import { TEACHER_CLASS_SCOPES_COLLECTION, assignmentScopeSignature, defaultSelectedClassIds, normalizeClassIds, teacherClassScopeId } from "../../../../lib/teacher-class-scope";

type Grade = 1 | 2 | 3;
type LegacyRow = { id: string; raw: Record<string, unknown>; student: SchoolStudent };
type CachedDocument = { id: string; data: Record<string, unknown> };
type RosterResponse = Record<string, unknown>;

function cacheSafeData(value: FirebaseFirestore.DocumentData) { return JSON.parse(JSON.stringify(value)) as Record<string, unknown>; }
const responseCache = new Map<string, { value: RosterResponse; expiresAt: number }>();
const responseInflight = new Map<string, Promise<RosterResponse>>();
const RESPONSE_TTL_MS = 60 * 60 * 1000;

const readCentralStudents = unstable_cache(async (gradeKey: string): Promise<CachedDocument[]> => {
  const grades = gradeKey.split(",").map(Number).filter(item => item >= 1 && item <= 3);
  if (!grades.length) return [];
  const snapshot = await adminDb().collection(SCHOOL_STUDENTS_COLLECTION).where("grade", "in", grades).get();
  return snapshot.docs.map(item => ({ id: item.id, data: cacheSafeData(item.data()) }));
}, ["teacher-central-roster-v3"], { revalidate: 3600 });
const readCentralClasses = unstable_cache(async (gradeKey: string): Promise<CachedDocument[]> => {
  const grades = gradeKey.split(",").map(Number).filter(item => item >= 1 && item <= 3);
  if (!grades.length) return [];
  const snapshot = await adminDb().collection(SCHOOL_CLASSES_COLLECTION).where("grade", "in", grades).get();
  return snapshot.docs.map(item => ({ id: item.id, data: cacheSafeData(item.data()) }));
}, ["teacher-central-classes-v3"], { revalidate: 3600 });
function explicitlyArchived(v: Record<string, unknown>) { return v.deleted === true || v.archived === true || Boolean(v.deletedAt) || Boolean(v.archivedAt) || String(v.status || "").toLowerCase() === "archived"; }
function normalizeLegacy(v: Record<string, unknown>, id: string) { return explicitlyArchived(v) ? null : normalizeStudentRecord({ ...v, active: true, rosterActive: true }, id); }
function classFromStudent(s: SchoolStudent): SchoolClass { return { id: classId(s.grade,s.section), grade:s.grade, section:s.section, name:canonicalClassName(s.grade,s.section), active:true }; }
function assignedGrades(assignments: Array<{grade:string}>, requested: Grade|null) { const grades=new Set<Grade>(assignments.map(i=>gradeNumber(i.grade)).filter((i):i is Grade=>!!i)); return requested ? (grades.has(requested)?new Set<Grade>([requested]):new Set<Grade>()) : grades; }
function classGradeFromId(v:string) { const g=Number(v.split("-")[0]); return g===1||g===2||g===3?g as Grade:null; }
function gradeFromWorkspace(v:string, subjectId:string):Grade|null { const marker=String(v||"").trim().lastIndexOf("--"); if(marker<0)return null; const w=String(v||"").trim(); if(w.slice(0,marker)!==subjectId)return null; const g=Number(w.slice(marker+2)||0); return g===1||g===2||g===3?g as Grade:null; }

async function buildRoster(session: NonNullable<Awaited<ReturnType<typeof requireSession>>>, subjectId:string, requestedGrade:Grade|null):Promise<RosterResponse> {
  const user=session.user!; const assignments=normalizeAssignments(user.assignments,user.subjectIds); const allRelevant=assignments.filter(i=>i.subjectId===subjectId); const relevant=requestedGrade?allRelevant.filter(i=>gradeNumber(i.grade)===requestedGrade):allRelevant; const grades=assignedGrades(allRelevant,requestedGrade);
  if(!subjectId||!relevant.length||!grades.size) return {ok:true,students:[],classes:[],availableClasses:[],selectedClassIds:[],assignments:relevant};
  const db=adminDb(); const subjectPath=`portalV2Data/${session.userId}/subjects/${subjectId}/students`; const scopeRef=db.collection(TEACHER_CLASS_SCOPES_COLLECTION).doc(teacherClassScopeId(session.userId,subjectId,requestedGrade)); const legacyScopeRef=db.collection(TEACHER_CLASS_SCOPES_COLLECTION).doc(teacherClassScopeId(session.userId,subjectId)); const gradeKey=[...grades].sort().join(",");
  const [legacySnapshot,scopeSnapshot,legacyScopeSnapshot,centralStudentDocuments,centralClassDocuments]=await Promise.all([db.collection(subjectPath).get(),scopeRef.get(),requestedGrade?legacyScopeRef.get():Promise.resolve({exists:false,data:()=>undefined}),readCentralStudents(gradeKey),readCentralClasses(gradeKey)]);
  const allLegacyRows=legacySnapshot.docs.map(i=>({id:i.id,raw:i.data() as Record<string,unknown>})).map(i=>({...i,student:normalizeLegacy(i.raw,i.id)})).filter((i):i is LegacyRow=>!!i.student);
  const centralRosterRows=centralStudentDocuments.map(i=>normalizeStudentRecord(i.data,i.id)).filter((i):i is SchoolStudent=>!!i&&i.active!==false); const centralByCode=new Map(centralRosterRows.map(s=>[s.code,s])); const centralAllRows=centralRosterRows.filter(i=>grades.has(i.grade as Grade));
  const legacyRows=allLegacyRows.map(i=>{const o=centralByCode.get(i.student.code); if(!o||!grades.has(o.grade as Grade))return null; return {...i,student:{...i.student,...o,id:o.code,code:o.code,grade:o.grade,section:o.section,className:canonicalClassName(o.grade,o.section),active:true} as SchoolStudent};}).filter((i):i is LegacyRow=>!!i);
  const availableMap=new Map<string,SchoolClass>(); centralClassDocuments.forEach(i=>{const c=normalizeClassRecord({id:i.id,...i.data} as Partial<SchoolClass>); if(c&&c.active!==false&&grades.has(c.grade as Grade))availableMap.set(c.id,c);}); centralAllRows.forEach(s=>availableMap.set(classId(s.grade,s.section),classFromStudent(s))); legacyRows.forEach(i=>availableMap.set(classId(i.student.grade,i.student.section),classFromStudent(i.student)));
  const allStageClasses=[...availableMap.values()].filter(i=>/^\d+-\d+$/.test(i.id)).sort((a,b)=>a.grade-b.grade||Number(a.section)-Number(b.section)); const sig=assignmentScopeSignature(assignments,subjectId,requestedGrade); const sd=scopeSnapshot.exists?scopeSnapshot.data() as Record<string,unknown>:null; const stored=normalizeClassIds(sd?.selectedClassIds).filter(id=>availableMap.has(id)&&grades.has(classGradeFromId(id) as Grade)); const saved=sd?.customized===true&&String(sd?.assignmentSignature||"")===sig;
  const ld=legacyScopeSnapshot.exists?legacyScopeSnapshot.data() as Record<string,unknown>:null; const legacySel=normalizeClassIds(ld?.selectedClassIds).filter(id=>availableMap.has(id)&&grades.has(classGradeFromId(id) as Grade)); const migrate=!scopeSnapshot.exists&&requestedGrade!==null&&ld?.customized===true&&legacySel.length>0; const customized=saved||migrate; const defaults=defaultSelectedClassIds(relevant,subjectId,allStageClasses,requestedGrade); const selectedClassIds=[...new Set(saved?stored:migrate?legacySel:defaults)].filter(id=>availableMap.has(id)&&grades.has(classGradeFromId(id) as Grade)); const selected=new Set(selectedClassIds); const availableClasses=customized?allStageClasses.filter(i=>selected.has(i.id)):allStageClasses;
  const selectedLegacy=legacyRows.filter(i=>selected.has(classId(i.student.grade,i.student.section))); const centralRows=centralAllRows.filter(i=>selected.has(classId(i.grade,i.section))); const byCode=new Map<string,SchoolStudent>(); selectedLegacy.forEach(i=>byCode.set(i.student.code,{...i.student,active:true})); centralRows.forEach(i=>{const p=byCode.get(i.code); byCode.set(i.code,{...p,...i,id:i.code,code:i.code,grade:i.grade,section:i.section,className:canonicalClassName(i.grade,i.section),active:true});});
  const students=[...byCode.values()].map(i=>({...i,id:i.code,code:i.code,className:canonicalClassName(i.grade,i.section),active:true,officialRoster:true})).sort((a,b)=>a.className.localeCompare(b.className,"ar",{numeric:true})||a.name.localeCompare(b.name,"ar")); const classes=allStageClasses.filter(i=>selected.has(i.id));
  return {ok:true,students,classes,availableClasses,selectedClassIds,scopeCustomized:customized,scopeInvalidated:Boolean(scopeSnapshot.exists&&!saved),assignments:relevant,assignedGrades:[...grades],activeGrade:requestedGrade,reservedForTeacher:selectedClassIds.length,hiddenOwnedByOtherTeachers:0,recoveredLegacy:selectedLegacy.length,preservedHiddenLegacy:Math.max(0,legacyRows.length-selectedLegacy.length),centralAdded:Math.max(0,students.length-selectedLegacy.length),repairPending:0,centralReadCount:centralStudentDocuments.length,classReadCount:centralClassDocuments.length,centralStudentCodes:centralByCode.size,deduplicatedStudentCodes:students.length,manualClassSelection:true,staleOwnersIgnored:0,officialAdminRoster:true,preservedTeacherData:true};
}

export async function GET(request:Request) {
  const session=await requireSession("teacher"); if(!session||!session.user)return NextResponse.json({ok:false},{status:401});
  try { const url=new URL(request.url); const subjectId=String(url.searchParams.get("subjectId")||"").trim(); const cookieStore=await cookies(); const wg=gradeFromWorkspace(cookieStore.get("lahooni_active_subject")?.value||"",subjectId); const gv=Number(url.searchParams.get("grade")||wg||0); const requested:Grade|null=gv===1||gv===2||gv===3?gv as Grade:null; const key=`${session.userId}:${subjectId}:${requested||"all"}`; const cached=responseCache.get(key); if(cached&&cached.expiresAt>Date.now()) return NextResponse.json(cached.value,{headers:{"Cache-Control":"private, max-age=300, stale-while-revalidate=3300"}}); let pending=responseInflight.get(key); if(!pending){ pending=buildRoster(session,subjectId,requested); responseInflight.set(key,pending); } const value=await pending; responseInflight.delete(key); responseCache.set(key,{value,expiresAt:Date.now()+RESPONSE_TTL_MS}); return NextResponse.json(value,{headers:{"Cache-Control":"private, max-age=300, stale-while-revalidate=3300"}}); }
  catch(error){console.error("teacher central roster failed",error); return NextResponse.json({ok:false,message:"تعذر تحميل قائمة الطلاب"},{status:500});}
}
