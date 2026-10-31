import {NextResponse} from "next/server";
import {revalidateTag} from "next/cache";
import {adminDb} from "../../../../lib/server/firebase-admin";
import {requireSession} from "../../../../lib/server/portal-auth";
import {SCHOOL_STUDENTS_COLLECTION} from "../../../../lib/school-roster";
export async function PATCH(request:Request){
 if(!await requireSession("admin"))return NextResponse.json({ok:false,message:"يجب الدخول بحساب الإدارة"},{status:403});
 try{
  const body=await request.json();
  const code=String(body.code||"").trim().toUpperCase();
  if(!/^TH[123][0-9]{3}$/.test(code))return NextResponse.json({ok:false,message:"رمز الطالب غير صالح"},{status:400});
  const allowed=["guardianName","guardianPhone","parentPhone2","emergencyPhone"] as const;
  const changes:Record<string,string>={};
  for(const field of allowed){
   if(typeof body[field]!=="string")return NextResponse.json({ok:false,message:"بيانات غير مكتملة"},{status:400});
   const value=body[field].trim().replace(/\\s+/g," ");
   if(value.length>120)return NextResponse.json({ok:false,message:"قيمة طويلة جدًا"},{status:400});
   if(field!=="guardianName"&&value&&!/^[+0-9٠-٩۰-۹ ()-]{7,22}$/.test(value))return NextResponse.json({ok:false,message:"تحقق من صيغة أرقام التواصل"},{status:400});
   changes[field]=value;
  }
  const ref=adminDb().collection(SCHOOL_STUDENTS_COLLECTION).doc(code);
  const snap=await ref.get();
  if(!snap.exists||snap.data()?.active===false||snap.data()?.stage!=="secondary")return NextResponse.json({ok:false,message:"الطالب غير موجود في المرحلة الثانوية"},{status:404});
  await ref.update({...changes,updatedAt:new Date().toISOString()});
  revalidateTag("admin-school-roster",{expire:0});
  revalidateTag("teacher-central-roster",{expire:0});
  return NextResponse.json({ok:true,changes},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({ok:false,message:"تعذر حفظ بيانات التواصل"},{status:500})}
}
export async function GET(request:Request){if(!await requireSession("admin"))return NextResponse.json({ok:false},{status:403});const code=String(new URL(request.url).searchParams.get("code")||"").trim().toUpperCase();if(!/^TH[123][0-9]{3}$/.test(code))return NextResponse.json({ok:false},{status:400});const snap=await adminDb().collection(SCHOOL_STUDENTS_COLLECTION).doc(code).get();if(!snap.exists)return NextResponse.json({ok:false},{status:404});const data=snap.data()||{};return NextResponse.json({ok:true,contact:{guardianName:String(data.guardianName||data.parentName||""),guardianPhone:String(data.guardianPhone||data.parentPhone||""),parentPhone2:String(data.parentPhone2||""),emergencyPhone:String(data.emergencyPhone||"")}},{headers:{"Cache-Control":"private, no-store"}})}
