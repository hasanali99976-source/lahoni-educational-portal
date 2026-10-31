import {NextResponse} from "next/server";
import {adminDb} from "../../../../../lib/server/firebase-admin";
import {requireSession} from "../../../../../lib/server/portal-auth";
import {tahdheebTeacherSeeds} from "../../../../../lib/school-tahdheeb-teachers";
const SCHOOL="tahdheeb-secondary",COLLECTION="schoolDirectoryTeachers";
type Row={id:string;name:string;subject:string;assignments:string[]};
export async function POST(request:Request){
 if(!await requireSession("admin"))return NextResponse.json({ok:false,message:"يلزم تسجيل الدخول للإدارة"},{status:401});
 try{
  const body=await request.json();
  const rows:Row[]=body.rows;
  if(!Array.isArray(rows)||rows.length<1||rows.length>30)return NextResponse.json({ok:false,message:"عدد المواد غير صالح"},{status:400});
  const ids=new Set<string>();
  for(const row of rows){
   if(!row||typeof row.id!=="string"||! /^[a-zA-Z0-9_-]{8,80}$/.test(row.id)||ids.has(row.id)||typeof row.name!=="string"||!row.name.trim()||row.name.length>120||typeof row.subject!=="string"||!row.subject.trim()||row.subject.length>120||!Array.isArray(row.assignments)||row.assignments.length>35||row.assignments.some(id=>typeof id!=="string"||!/^([123])-([1-9][0-9]?)$/.test(id)))return NextResponse.json({ok:false,message:"تحقق من المواد والفصول قبل الحفظ"},{status:400});
   ids.add(row.id);
  }
  const collection=adminDb().collection(COLLECTION);
  const refs=rows.map(row=>collection.doc(row.id));
  const snapshots=await adminDb().getAll(...refs);
  for(let i=0;i<rows.length;i++){
   const existing=snapshots[i];
   if(existing.exists&&existing.data()?.schoolId!==SCHOOL)return NextResponse.json({ok:false,message:"سجل غير تابع لهذه المدرسة"},{status:403});
   if(!existing.exists&&!tahdheebTeacherSeeds.some(seed=>seed.id===rows[i].id))return NextResponse.json({ok:false,message:"سجل معلم غير موجود"},{status:404});
  }
  const batch=adminDb().batch(),updatedAt=new Date().toISOString();
  rows.forEach((row,i)=>batch.set(refs[i],{schoolId:SCHOOL,name:row.name.trim(),subject:row.subject.trim(),assignments:[...new Set(row.assignments)],deleted:false,updatedAt},{merge:true}));
  await batch.commit();
  return NextResponse.json({ok:true,updated:rows.length});
 }catch{return NextResponse.json({ok:false,message:"تعذر حفظ الإسنادات، لم تُعتمد تغييرات جزئية"},{status:500})}
}
