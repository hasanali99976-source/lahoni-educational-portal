import { NextResponse } from "next/server";
import { requireSession } from "../../../../lib/server/portal-auth";
import { normalizeAssignments } from "../../../../lib/teacher-assignments";

export const runtime="nodejs";

function clean(v:unknown,n=180){return String(v??"").replace(/\s+/g," ").trim().slice(0,n)}
function norm(v:unknown){return String(v??"").normalize("NFKC").replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,"").replace(/[أإآٱ]/g,"ا").replace(/[ىی]/g,"ي").replace(/ة/g,"ه").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/ﷲ/g,"الله").replace(/عبدا+لله/g,"عبدالله").replace(/عبد\s+الله/g,"عبدالله").replace(/[ًٌٍَُِّْـ]/g,"").replace(/[^\p{L}\p{N}%]+/gu," ").replace(/\s+/g," ").trim().toLowerCase()}
function parts(v:unknown){return norm(v).split(" ").filter(Boolean).filter(x=>x!=="بن"&&x!=="ابن")}
function assigned(session:NonNullable<Awaited<ReturnType<typeof requireSession>>>,subjectId:string){return Boolean(session.user&&/^[a-z0-9_-]+$/i.test(subjectId)&&normalizeAssignments(session.user.assignments,session.user.subjectIds).some(x=>x.subjectId===subjectId))}

type Student={code:string;name:string;className:string};
type Extracted={name:string;score:number|null;percent:number|null};

function extractRows(text:string):Extracted[]{
  const teacher=norm("حسن علي باقر الطويل");
  const lines=String(text||"").split(/\r?\n/).map(x=>norm(x)).filter(Boolean);
  const rows:Extracted[]=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i],at=line.indexOf(teacher); if(at<0)continue;
    let name=line.slice(0,at).trim();
    const after=line.slice(at+teacher.length).trim();
    if(i>0&&parts(name).length<=3){const prev=lines[i-1];if(!/\d|عنوان التقرير|اسم الطالب|اسم المعلم|اسم الدوره|ثانويه التهذيب|page/i.test(prev)&&parts(prev).length>=1&&parts(prev).length<=8)name=`${prev} ${name}`.trim()}
    if(parts(name).length<2)continue;
    const percentMatch=after.match(/(?:^|\s)(\d{1,3})%(?:\s|$)/);
    const beforePercent=percentMatch?after.slice(0,percentMatch.index).trim():after;
    const nums=beforePercent.match(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/g)?.map(x=>Number(x.trim())).filter(Number.isFinite)||[];
    rows.push({name:clean(name),score:nums.length?nums[nums.length-1]:null,percent:percentMatch?Number(percentMatch[1]):null});
  }
  return rows;
}
function exactMatch(student:Student,row:Extracted){const a=[...new Set(parts(student.name))],b=[...new Set(parts(row.name))];return a.length>=2&&a.every(x=>b.includes(x))}

export async function POST(request:Request){
  const session=await requireSession("teacher"); if(!session)return NextResponse.json({ok:false},{status:401});
  try{
    const form=await request.formData(); const subjectId=clean(form.get("subjectId"),80);
    if(!assigned(session,subjectId))return NextResponse.json({ok:false,message:"هذه المادة غير مسندة إلى حسابك."},{status:403});
    let roster:Student[]=[]; try{const p=JSON.parse(String(form.get("roster")||"[]"));if(Array.isArray(p))roster=p.map(x=>({code:clean(x?.code,40).toUpperCase(),name:clean(x?.name),className:clean(x?.className||x?.class,80)})).filter(x=>x.code&&x.name)}catch{}
    const files=form.getAll("files").filter((x):x is File=>x instanceof File); if(!files.length)return NextResponse.json({ok:false,message:"اختر ملفات PDF."},{status:400});
    const pdfParse=(await import("pdf-parse")).default; const result=[];
    for(const file of files){
      if(file.size>12*1024*1024)return NextResponse.json({ok:false,message:`${file.name} أكبر من 12MB.`},{status:400});
      const parsed=await pdfParse(Buffer.from(await file.arrayBuffer())); const extracted=extractRows(String(parsed.text||""));
      const rows=extracted.map(row=>{const matches=roster.filter(s=>exactMatch(s,row));return{...row,status:matches.length===1?"matched":matches.length>1?"ambiguous":"unmatched",student:matches.length===1?matches[0]:null}});
      result.push({file:clean(file.name,120),pages:Number(parsed.numpages||1),extracted:rows.length,matched:rows.filter(x=>x.status==="matched").length,unmatched:rows.filter(x=>x.status!=="matched").length,rows});
    }
    return NextResponse.json({ok:true,readOnly:true,files:result},{headers:{"Cache-Control":"no-store"}});
  }catch(e){console.error("classera-preview",e);return NextResponse.json({ok:false,message:"تعذر تحليل ملف كلاسيرا."},{status:500})}
}
