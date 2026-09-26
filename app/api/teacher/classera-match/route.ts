import { NextResponse } from "next/server";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";

export const runtime="nodejs";

function clean(value:unknown,limit=160){return String(value??"").replace(/\s+/g," ").trim().slice(0,limit)}
function normalizeArabic(value:unknown){return String(value??"").normalize("NFKC").replace(/[أإآٱ]/g,"ا").replace(/[ىی]/g,"ي").replace(/ة/g,"ه").replace(/[ؤ]/g,"و").replace(/[ئ]/g,"ي").replace(/(?:عبد\s*ا?الله|عبداالله|عبدالله)/g,"عبدالله").replace(/[ًٌٍَُِّْـ]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim().toLowerCase()}
function compactArabic(value:unknown){return normalizeArabic(value).replace(/\s+/g,"")}
function tokens(value:unknown){return normalizeArabic(value).split(" ").filter(token=>token.length>=2)}
function assigned(session:NonNullable<Awaited<ReturnType<typeof requireSession>>>,subjectId:string){return Boolean(session.user&&/^[a-z0-9_-]+$/i.test(subjectId)&&normalizeAssignments(session.user.assignments,session.user.subjectIds).some(item=>item.subjectId===subjectId))}

type RosterRow={code:string;name:string;className:string};
type NormalizedRosterRow=RosterRow&{normalized:string;compact:string;parts:string[]};

function orderedSubsequence(parts:string[],words:string[]){let cursor=0;for(const part of parts){const found=words.indexOf(part,cursor);if(found<0)return false;cursor=found+1}return true}
function studentAppears(student:NormalizedRosterRow,text:string,compactText:string,textWords:Set<string>,words:string[]){
  if(student.normalized.length>=5&&text.includes(` ${student.normalized} `))return true;
  if(student.compact.length>=6&&compactText.includes(student.compact))return true;
  const parts=student.parts;
  if(parts.length<2)return false;
  if(orderedSubsequence(parts,words))return true;
  const unique=[...new Set(parts)];
  const found=unique.filter(part=>textWords.has(part)).length;
  if(unique.length===2)return found===2;
  const required=Math.max(3,unique.length-1);
  if(found<required)return false;
  return textWords.has(unique[0])&&textWords.has(unique[unique.length-1]);
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
    const normalizedRoster:NormalizedRosterRow[]=roster.map(item=>({...item,normalized:normalizeArabic(item.name),compact:compactArabic(item.name),parts:tokens(item.name)}));
    const counts:Record<string,number>={};
    const perFile:Array<{name:string;matched:number;textWords:number,pages:number,textLength:number}>=[];
    for(const file of files){
      if(file.size>12*1024*1024)return NextResponse.json({ok:false,message:`الملف ${file.name} أكبر من 12MB.`},{status:400});
      const buffer=Buffer.from(await file.arrayBuffer());
      let text="";let pages=1;
      if(file.type.includes("pdf")||file.name.toLowerCase().endsWith(".pdf")){
        const parsed=await pdfParse(buffer);
        text=String(parsed.text||"");
        pages=Math.max(1,Number(parsed.numpages||1));
      }else{text=buffer.toString("utf8")}
      const normalized=normalizeArabic(text);
      const normalizedText=` ${normalized} `;
      const compactText=normalized.replace(/\s+/g,"");
      const words=normalized.split(" ").filter(Boolean);
      const textWords=new Set(words);
      let matched=0;
      for(const student of normalizedRoster){
        if(studentAppears(student,normalizedText,compactText,textWords,words)){
          counts[student.code]=(counts[student.code]||0)+1;
          matched++;
        }
      }
      perFile.push({name:clean(file.name,120),matched,textWords:textWords.size,pages,textLength:text.length});
    }
    const rows=roster.map(student=>({code:student.code,name:student.name,className:student.className,count:counts[student.code]||0}));
    const totalMatched=rows.filter(row=>row.count>0).length;
    return NextResponse.json({ok:true,totalFiles:files.length,totalMatched,rows,files:perFile},{headers:{"Cache-Control":"no-store"}});
  }catch(error){console.error("classera-match",error);return NextResponse.json({ok:false,message:"تعذر قراءة تقارير كلاسيرا كاملة. إذا كان التقرير صورًا ممسوحة فلن يمكن استخراج الأسماء كنص."},{status:500})}
}
