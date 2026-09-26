import { NextResponse } from "next/server";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";

export const runtime="nodejs";

function clean(value:unknown,limit=160){return String(value??"").replace(/\s+/g," ").trim().slice(0,limit)}
function normalizeArabic(value:unknown){
  return String(value??"").normalize("NFKC")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,"")
    .replace(/[أإآٱ]/g,"ا").replace(/[ىی]/g,"ي").replace(/ة/g,"ه").replace(/ؤ/g,"و").replace(/ئ/g,"ي")
    .replace(/ﷲ/g,"الله").replace(/عبدا+لله/g,"عبدالله").replace(/عبد\s+الله/g,"عبدالله")
    .replace(/[ًٌٍَُِّْـ]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim().toLowerCase();
}
function identityParts(value:unknown){return normalizeArabic(value).split(" ").filter(Boolean).filter(part=>part!=="بن"&&part!=="ابن")}
function assigned(session:NonNullable<Awaited<ReturnType<typeof requireSession>>>,subjectId:string){return Boolean(session.user&&/^[a-z0-9_-]+$/i.test(subjectId)&&normalizeAssignments(session.user.assignments,session.user.subjectIds).some(item=>item.subjectId===subjectId))}

type RosterRow={code:string;name:string;className:string};
type NormalizedRosterRow=RosterRow&{parts:string[]};

// التقرير نفسه يضع اسم الطالب مباشرة قبل اسم المعلم. نستخرج أسماء سجلات كلاسيرا أولاً
// بدل البحث في كامل نص PDF، وندمج السطر السابق عندما يكون الاسم الطويل مكسوراً على سطرين.
function extractClasseraStudentNames(text:string){
  const teacher=normalizeArabic("حسن علي باقر الطويل");
  const lines=String(text||"").split(/\r?\n/).map(line=>normalizeArabic(line)).filter(Boolean);
  const names:string[]=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    const at=line.indexOf(teacher);
    if(at<0)continue;
    let name=line.slice(0,at).trim();
    if(!name)continue;
    const currentParts=name.split(" ").filter(Boolean);
    if(i>0&&currentParts.length<=3){
      const prev=lines[i-1];
      const prevParts=prev.split(" ").filter(Boolean);
      const excluded=/\d|عنوان التقرير|اسم الطالب|اسم المعلم|اسم الدوره|ثانويه التهذيب|التدوين|التفكير|page/i.test(prev);
      if(!excluded&&prevParts.length>=2&&prevParts.length<=8)name=`${prev} ${name}`.trim();
    }
    if(identityParts(name).length>=2)names.push(name);
  }
  return names;
}

function sameFullName(student:NormalizedRosterRow,extracted:string){
  const required=[...new Set(student.parts)];
  const actual=[...new Set(identityParts(extracted))];
  if(required.length<2||actual.length<2)return false;
  return required.every(part=>actual.includes(part));
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
    const perFile:Array<{name:string;matched:number;extractedNames:number;pages:number;textLength:number}>=[];
    for(const file of files){
      if(file.size>12*1024*1024)return NextResponse.json({ok:false,message:`الملف ${file.name} أكبر من 12MB.`},{status:400});
      const buffer=Buffer.from(await file.arrayBuffer());
      let text="";let pages=1;
      if(file.type.includes("pdf")||file.name.toLowerCase().endsWith(".pdf")){
        const parsed=await pdfParse(buffer);text=String(parsed.text||"");pages=Math.max(1,Number(parsed.numpages||1));
      }else{text=buffer.toString("utf8")}
      const extractedNames=extractClasseraStudentNames(text);
      let matched=0;
      for(const student of normalizedRoster){
        if(extractedNames.some(name=>sameFullName(student,name))){counts[student.code]=(counts[student.code]||0)+1;matched++}
      }
      perFile.push({name:clean(file.name,120),matched,extractedNames:extractedNames.length,pages,textLength:text.length});
    }
    const rows=roster.map(student=>({code:student.code,name:student.name,className:student.className,count:counts[student.code]||0}));
    return NextResponse.json({ok:true,totalFiles:files.length,totalMatched:rows.filter(row=>row.count>0).length,rows,files:perFile},{headers:{"Cache-Control":"no-store"}});
  }catch(error){console.error("classera-match",error);return NextResponse.json({ok:false,message:"تعذر قراءة تقارير كلاسيرا كاملة."},{status:500})}
}
