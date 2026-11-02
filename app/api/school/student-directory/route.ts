import {NextResponse} from "next/server";
import {unstable_cache} from "next/cache";
import {createHash} from "node:crypto";
import {adminDb} from "../../../../lib/server/firebase-admin";
import {SCHOOL_STUDENTS_COLLECTION,SCHOOL_CLASSES_COLLECTION,normalizeStudentRecord,normalizeClassRecord,classId} from "../../../../lib/school-roster";

// Public school directory: names and class placement only. Never expose login codes,
// guardian details, contact information, absence or academic records.
const roster=unstable_cache(async()=>{
 const db=adminDb();
 const [studentSnap,classSnap]=await Promise.all([db.collection(SCHOOL_STUDENTS_COLLECTION).get(),db.collection(SCHOOL_CLASSES_COLLECTION).get()]);
 const students=studentSnap.docs.map(d=>normalizeStudentRecord(d.data() as Record<string,unknown>,d.id))
 .filter(s=>s&&s.active!==false&&s.stage==="secondary")
 .map(s=>({id:createHash("sha256").update(s!.code).digest("hex").slice(0,24),name:s!.name,grade:s!.grade,section:s!.section,className:s!.className,active:true}));
 const byId=new Map<string,{id:string;grade:number;section:string;name:string}>();
 classSnap.docs.forEach(d=>{const c=normalizeClassRecord({id:d.id,...d.data()});if(c&&c.active!==false&&c.stage==="secondary")byId.set(c.id,{id:c.id,grade:c.grade,section:c.section,name:c.name})});
 students.forEach(s=>{const id=classId(s.grade,s.section,"secondary");if(!byId.has(id))byId.set(id,{id,grade:s.grade,section:s.section,name:s.className})});
 return {students,classes:[...byId.values()]};
},["public-secondary-school-directory-v1"],{revalidate:300,tags:["admin-school-roster"]});
export async function GET(){try{return NextResponse.json({ok:true,...await roster()},{headers:{"Cache-Control":"public, s-maxage=300, stale-while-revalidate=60"}})}catch(error){console.error("public school directory failed",error);return NextResponse.json({ok:false,message:"تعذر تحميل أسماء الطلاب"},{status:500})}}
