import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { getSubjectConfig } from "../../../../lib/subject-config";

export async function POST(request:Request){
 try{
  const body=await request.json();const parentCode=String(body?.parentCode||"").trim().toUpperCase();
  if(!/^PR[A-Z0-9]{6,16}$/.test(parentCode))return NextResponse.json({ok:false,message:"أدخل كود ولي الأمر الصحيح"},{status:400});
  const cipher="4826071593";const encoded=parentCode.slice(2);const nationalId=[...encoded].map(char=>cipher.indexOf(char)).reverse().join("");
  if(!/^\d{10}$/.test(nationalId))return NextResponse.json({ok:false,message:"كود ولي الأمر غير صحيح"},{status:400});
  const assignments=await adminDb().collection("portalV2Assignments").where("active","==",true).get();
  const matches=await Promise.all(assignments.docs.slice(0,100).map(async assignment=>{const{teacherId,subjectId}=assignment.data() as{teacherId:string;subjectId:string};const teacher=await adminDb().collection("portalV2Users").doc(teacherId).get();if(!teacher.exists||teacher.data()?.active!==true)return null;const students=await adminDb().collection(`portalV2Data/${teacherId}/subjects/${subjectId}/students`).where("nationalId","==",nationalId).limit(5).get();if(students.empty)return null;const subject=getSubjectConfig(subjectId);return students.docs.map(document=>({id:document.id,teacherId,subjectKey:subjectId,subjectLabel:subject.label,teacherName:teacher.data()?.name||"المعلم",icon:subject.icon||"📘",data:document.data()}))}));
  const valid=matches.flatMap(item=>item||[]);if(!valid.length)return NextResponse.json({ok:false,message:"الكود غير صحيح أو لم يُربط بولي أمر بعد"},{status:401});
  return NextResponse.json({ok:true,matches:valid});
 }catch(error){console.error("parent lookup failed",error);return NextResponse.json({ok:false,message:"تعذر فتح بوابة ولي الأمر الآن"},{status:500})}
}
