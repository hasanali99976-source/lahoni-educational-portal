import { NextResponse } from "next/server";
import { adminDb } from "../../../../lib/server/firebase-admin";
import { requireSession } from "../../../../lib/server/portal-auth";
const ref=()=>adminDb().collection("portalV2Settings").doc("secondaryDailyAbsence");
export async function GET(){if(!await requireSession("admin"))return NextResponse.json({ok:false},{status:401});const s=await ref().get();return NextResponse.json({ok:true,teacherId:String(s.data()?.teacherId||"")},{headers:{"Cache-Control":"no-store"}})}
export async function PUT(request:Request){if(!await requireSession("admin"))return NextResponse.json({ok:false},{status:401});const body=await request.json().catch(()=>({}));const teacherId=String(body.teacherId||"").trim();if(teacherId){const teacher=await adminDb().collection("portalV2Users").doc(teacherId).get();if(!teacher.exists||teacher.data()?.role!=="teacher"||teacher.data()?.active===false)return NextResponse.json({ok:false,message:"اختر معلماً نشطاً"},{status:400})}await ref().set({teacherId,updatedAt:new Date().toISOString()},{merge:true});return NextResponse.json({ok:true})}
