import { NextResponse } from "next/server";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";

export const runtime="nodejs";

function clean(value:unknown,limit=160){return String(value??"").replace(/\s+/g," ").trim().slice(0,limit)}
function normalizeArabic(value:unknown){return String(value??"").normalize("NFKC").replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[ؤ]/g,"و").replace(/[ئ]/g,"ي").replace(/[ًٌٍَُِّْـ]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim().toLowerCase()}
function tokens(value:unknown){return normalizeArabic(value).split(" ").filter(token=>token.length>=2)}
function assigned(session:NonNullable<Awaited<ReturnType<typeof requireSession>>>,subjectId:string){return Boolean(session.user&&/^[a-z0-9_-]+$/i.test(subjectId)&&normalizeAssignments(session.user.assignments,session.user.subjectIds).some(item=>item.subjectId===subjectId))}

type RosterRow={code:string;name:string;className:string};
type NormalizedRosterRow=RosterRow&{normalized:string;parts:string[]};

function studentAppears(student:NormalizedRosterRow,text:string,textWords:Set<string>){
  if(student.normalized.length>=5&&text.includes(` ${student.normalized} `))return true;
  const parts=student.parts;
  if(parts.length<2)return false;
  const found=parts.filter(part=>textWords.has(part)).length;
  // Classera PDF extraction may split/reorder Arabic names. Require every word for short names,
  // and all but one word for names of 4+ parts to stay conservative and avoid false matches.
  const required=parts.length>=4?parts.length-1:parts.length;
  if(found<required)return false;
  // Require first or last name too; prevents matching only common middle family words.
  return textWords.has(parts[0])||textWords.has(parts[parts.length-1]);
}

export async function POST(request:Request){
  const session=await requireSession("teacher");
  if(!session)return NextResponse.json({ok:false},{status:401});
  try{
    const form=await request.formData();
    const subjectId=clean(form.get("subjectId"),80);
    if(!assigned(session,subjectId))return NextResponse.json({ok:false,message:"هذه المادة غير مسندة إلى حسابك."},{status:403});
    const rosterRaw=clean(form.get("roster"),200000);
    let roster:RosterRow[]=[];
    try{const parsed=JSON.parse(rosterRaw);if(Array.isArray(parsed))roster=parsed.map(item=>({code:clean(item?.code,40).toUpperCase(),name:clean(item?.name,160),className:clean(item?.className||item?.class,80)})).filter(item=>item.code&&item.name)}catch{}
    if(!roster.length)return NextResponse.json({ok:false,message:"لا توجد قائمة طلاب صالحة للمطابقة."},{status:400});
    if(roster.length>800)return NextResponse.json({ok:false,message:"عدد الطلاب أكبر من الحد المسموح."},{status:400});
    const files=form.getAll("files").filter((item):item is File=>item instanceof File);
    if(!files.length)return NextResponse.json({ok:false,message:"اختر ملفات تقارير كلاسيرا أولًا."},{status:400});
    if(files.length>30)return NextResponse.json({ok:false,message:"يمكن رفع 30 تقريرًا كحد أقصى في العملية الواحدة."},{status:400});
    const pdfParse=(await import("pdf-parse")).default;
    const normalizedRoster:NormalizedRosterRow[]=roster.map(item=>({...item,normalized:normalizeArabic(item.name),parts:tokens(item.name)}));
    const counts:Record<string,number>={};
    const perFile:Array<{name:string;matched:number;textWords:number}>=[];
    for(const file of files){
      if(file.size>12*1024*1024)return NextResponse.json({ok:false,message:`الملف ${file.name} أكبر من 12MB.`},{status:400});
      const buffer=Buffer.from(await file.arrayBuffer());
      let text="";
      if(file.type.includes("pdf")||file.name.toLowerCase().endsWith(".pdf")){const parsed=await pdfParse(buffer);text=String(parsed.text||"")}else{text=buffer.toString("utf8")}
      const normalized=normalizeArabic(text);
      const normalizedText=` ${normalized} `;
      const textWords=new Set(normalized.split(" ").filter(Boolean));
      let matched=0;
      for(const student of normalizedRoster){
        if(studentAppears(student,normalizedText,textWords)){
          counts[student.code]=(counts[student.code]||0)+1;
          matched++;
        }
      }
      perFile.push({name:clean(file.name,120),matched,textWords:textWords.size});
    }
    const rows=roster.map(student=>({code:student.code,name:student.name,className:student.className,count:counts[student.code]||0}));
    const totalMatched=rows.filter(row=>row.count>0).length;
    return NextResponse.json({ok:true,totalFiles:files.length,totalMatched,rows,files:perFile},{headers:{"Cache-Control":"no-store"}});
  }catch(error){console.error("classera-match",error);return NextResponse.json({ok:false,message:"تعذر قراءة تقارير كلاسيرا. تأكد أن الملفات PDF نصية وليست صورًا ممسوحة."},{status:500})}
}
