import {NextResponse} from "next/server";
import {requireSession} from "../../../../lib/server/portal-auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!await requireSession("admin"))return NextResponse.json({ok:false,message:"يلزم تسجيل دخول الإدارة"},{status:401});
 try{
 const form=await request.formData();const file=form.get("file");
 if(!(file instanceof File))return NextResponse.json({ok:false,message:"اختر ملف PDF"},{status:400});
 if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf"))return NextResponse.json({ok:false,message:"استخراج النص متاح حاليًا لملفات PDF النصية فقط. الصور تحتاج قراءة بصرية."},{status:415});
 if(file.size>8*1024*1024)return NextResponse.json({ok:false,message:"الحد الأقصى 8 ميجابايت"},{status:413});
 const buffer=Buffer.from(await file.arrayBuffer());
 const mod=await import("pdf-parse");const parse=(mod.default||mod) as unknown as (data:Buffer)=>Promise<{text:string;numpages:number}>;
 const result=await parse(buffer);const text=result.text.trim().slice(0,50000);
 if(!text)return NextResponse.json({ok:false,message:"الملف يبدو مصورًا دون نص قابل للاستخراج. أرسل الصورة أو PDF هنا لاستخراج البيانات بصريًا."},{status:422});
 return NextResponse.json({ok:true,text,pages:result.numpages},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({ok:false,message:"تعذر قراءة PDF. قد يكون مصورًا أو محميًا."},{status:422})}
}