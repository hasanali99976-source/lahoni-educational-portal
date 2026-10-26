import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
import { SCHOOL_STUDENTS_COLLECTION, normalizeStudentRecord, normalizeArabic } from "../../../../lib/school-roster";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Row = { code:string; name:string; className:string; teacher:string; subject:string; documentId:string; hasGrades:boolean; hasNotes:boolean; issue:string };
const codeOf=(v:unknown)=>String(v||"").trim().toUpperCase();
const nameOf=(v:unknown)=>normalizeArabic(v);
const gradesOf=(d:Record<string,unknown>)=>["gradeValues","gradePlanValues","gradeDeductions"].some(key=>{const v=d[key];return Array.isArray(v)?v.length>0:!!v&&typeof v==="object"&&Object.keys(v).length>0});
export async function GET(request:Request){
 if(!await requireSession("admin"))return NextResponse.json({ok:false},{status:401});
 try{
  const url=new URL(request.url);
  const filter=codeOf(url.searchParams.get("code"));
  const db=adminDb();
  const [officialSnap,teacherSnap]=await Promise.all([db.collection(SCHOOL_STUDENTS_COLLECTION).get(),db.collection("portalV2Users").where("role","==","teacher").get()]);
  const official=officialSnap.docs.map(doc=>normalizeStudentRecord(doc.data() as Record<string,unknown>,doc.id)).filter((v):v is NonNullable<typeof v>=>!!v);
  const active=new Map(official.filter(v=>v.active!==false).map(v=>[codeOf(v.code),v]));
  const archived=new Set(official.filter(v=>v.active===false).map(v=>codeOf(v.code)));
  const teachers=teacherSnap.docs.flatMap(doc=>{const data=doc.data();const assignments=normalizeAssignments(data.assignments,Array.isArray(data.subjectIds)?data.subjectIds:[]);return [...new Set(assignments.map(a=>a.subjectId).filter(Boolean))].map(subject=>({id:doc.id,name:String(data.name||doc.id),subject}));});
  const rows:Row[]=[];const seen=new Set<string>();const limit=3000;
  for(let i=0;i<teachers.length;i+=4){
   const batch=teachers.slice(i,i+4);
   const results=await Promise.all(batch.map(async t=>({t,snapshot:await db.collection(`portalV2Data/${t.id}/subjects/${t.subject}/students`).get()})));
   for(const {t,snapshot} of results){
    for(const doc of snapshot.docs){
     const d=doc.data() as Record<string,unknown>;
     const code=codeOf(d.code||d.accessCode||d.studentCode||doc.id);
     const officialStudent=active.get(code);
     const studentName=String(d.name||"").trim();
     const grade=gradesOf(d);
     const notes=Array.isArray(d.teacherNotes)&&d.teacherNotes.length>0;
     let issue="";
     if(!officialStudent)issue=archived.has(code)?"طالب مؤرشف في الإدارة":"كود غير موجود في قائمة الإدارة";
     else if(studentName&&nameOf(studentName)!==nameOf(officialStudent.name))issue="اختلاف الاسم مع كود الإدارة";
     else if(doc.id.toUpperCase()!==code)issue="مستند إضافي مرتبط بنفس الباركود";
     if(!issue&&!grade&&!notes)continue;
     if(filter&&code!==filter&&codeOf(doc.id)!==filter&&!nameOf(studentName).includes(nameOf(filter)))continue;
     const key=`${t.id}|${t.subject}|${doc.id}`;
     if(seen.has(key))continue;seen.add(key);
     rows.push({code,name:officialStudent?.name||studentName,className:officialStudent?.className||String(d.className||d.class||""),teacher:t.name,subject:t.subject,documentId:doc.id,hasGrades:grade,hasNotes:notes,issue});
     if(rows.length>=limit)break;
    }
    if(rows.length>=limit)break;
   }
   if(rows.length>=limit)break;
  }
  const officialRows=official.filter(s=>!filter||codeOf(s.code)===filter||nameOf(s.name).includes(nameOf(filter))).map(s=>({code:s.code,name:s.name,className:s.className,active:s.active,linked:rows.some(r=>r.code===codeOf(s.code))}));
  return NextResponse.json({ok:true,generatedAt:new Date().toISOString(),officialTotal:official.length,activeTotal:active.size,archivedTotal:archived.size,teachersChecked:teachers.length,rows,officialRows,limited:rows.length>=limit,readOnly:true},{headers:{"Cache-Control":"no-store"}});
 }catch(error){console.error("admin student audit failed",error);return NextResponse.json({ok:false,message:"تعذر فحص سجلات الطلاب. حاول مجددًا."},{status:500});}
}
