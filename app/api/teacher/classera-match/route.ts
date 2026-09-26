import { NextResponse } from "next/server";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";

export const runtime="nodejs";

function clean(value:unknown,limit=160){return String(value??"").replace(/\s+/g," ").trim().slice(0,limit)}
function normalizeArabic(value:unknown){
  return String(value??"").normalize("NFKC")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,"")
    .replace(/[أإآٱ]/g,"ا").replace(/[ىی]/g,"ي").replace(/ة/g,"ه").replace(/ؤ/g,"و").replace(/ئ/g,"ي")
    .replace(/عبدا+لله/g,"عبدالله").replace(/عبد\s+الله/g,"عبدالله")
    .replace(/[ًٌٍَُِّْـ]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim().toLowerCase();
}
function identityParts(value:unknown){return normalizeArabic(value).split(" ").filter(Boolean).filter(part=>part!=="بن"&&part!=="ابن")}
function assigned(session:NonNullable<Awaited<ReturnType<typeof requireSession>>>,subjectId:string){return Boolean(session.user&&/^[a-z0-9_-]+$/i.test(subjectId)&&normalizeAssignments(session.user.assignments,session.user.subjectIds).some(item=>item.subjectId===subjectId))}

type RosterRow={code:string;name:string;className:string};
type NormalizedRosterRow=RosterRow&{parts:string[]};

// يطابق هوية الاسم كاملة بترتيبها، مع السماح لكلاسيرا بإضافة "بن/ابن" أو بكسر الاسم بين سطرين.
// لا توجد مطابقة بالاسم الأول وحده.
function studentAppears(student:NormalizedRosterRow,words:string[]){
  const parts=student.parts;
  if(parts.length<2)return false;
  for(let start=0;start<words.length;start++){
    if(words[start]!==parts[0])continue;
    let wi=start+1,pi=1;
    while(wi<words.length&&pi<parts.length&&wi-start<=parts.length*3+6){
      if(words[wi]==="بن"||words[wi]==="ابن"){wi++;continue}
      if(words[wi]===parts[pi]){pi++;wi++;continue}
      // يسمح بكلمة إضافية محدودة من صيغة كلاسيرا، لكن لا يسقط أي جزء من اسم البوابة.
      wi++;
    }
    if(pi===parts.length)return true;
  }
  return false;
}

export async function POST(request:Request){
  const session=await requireSession("teacher");
  if(!session)return NextResponse.json({ok:false},{status:401});
  try{
    const form=await request.formData();
    const subjectId=clean(form.get("subjectId"),80);
    if(!assigned(session,subjectId))return NextResponse.json({ok:false,message:"هذه المادة غير مسندة إلى حسابك."},{status:403});
    const rosterRaw=String(form.get("roster")??"").slice(0,200000);
    let roster:RosterRow[]=[];
    try{const parsed=JSON.parse(rosterRaw);if(Array.isArray(parsed))roster=parsed.map(item=>({code:clean(item?.code,40).toUpperCase(),name:clean(item?.name,160),className:clean(item?.className||item?.class,80)})).filter(item=>item.code&&item.name)}catch{}
    if(!roster.length)return NextResponse.json({ok:false,message:"لا توجد قائمة طلاب صالحة للمطابقة."},{status:400});
    if(roster.length>800)return NextResponse.json({ok:false,message:"عدد الطلاب أكبر من الحد المسموح."},{status:400});
    const files=form.getAll("files").filter((item):item is File=>item instanceof File);
    if(!files.length)return NextResponse.json({ok:false,message:"اختر ملفات تقارير كلاسيرا أولًا."},{status:400});
    if(files.length>30)return NextResponse.json({ok:false,message:"يمكن رفع 30 تقريرًا كحد أقصى في العملية الواحدة."},{status:400});
    const pdfParse=(await import("pdf-parse")).default;
    const normalizedRoster:NormalizedRosterRow[]=roster.map(item=>({...item,parts:identityParts(item.name)}));
    const counts:Record<string,number>={};
    const perFile:Array<{name:string;matched:number;textWords:number,pages:number,textLength:number}>=[];
    for(const file of files){
      if(file.size>12*1024*1024)return NextResponse.json({ok:false,message:`الملف ${file.name} أكبر من 12MB.`},{status:400});
      const buffer=Buffer.from(await file.arrayBuffer());
      let text="";let pages=1;
      if(file.type.includes("pdf")||file.name.toLowerCase().endsWith(".pdf")){
        const parsed=await pdfParse(buffer);text=String(parsed.text||"");pages=Math.max(1,Number(parsed.numpages||1));
      }else{text=buffer.toString("utf8")}
      const normalized=normalizeArabic(text);
      const words=normalized.split(" ").filter(Boolean);
      let matched=0;
      for(const student of normalizedRoster){if(studentAppears(student,words)){counts[student.code]=(counts[student.code]||0)+1;matched++}}
      perFile.push({name:clean(file.name,120),matched,textWords:words.length,pages,textLength:text.length});
    }
    const rows=roster.map(student=>({code:student.code,name:student.name,className:student.className,count:counts[student.code]||0}));
    return NextResponse.json({ok:true,totalFiles:files.length,totalMatched:rows.filter(row=>row.count>0).length,rows,files:perFile},{headers:{"Cache-Control":"no-store"}});
  }catch(error){console.error("classera-match",error);return NextResponse.json({ok:false,message:"تعذر قراءة تقارير كلاسيرا كاملة."},{status:500})}
}
