"use client";

import { jsPDF } from "jspdf";
import {
  PRINT_ACCENTS,
  PRINT_HEIGHT,
  PRINT_WIDTH,
  STUDENT_NAME_FONT_SIZE,
  createPrintCanvas,
  drawFittedText,
  drawFixedText,
  drawImageContain,
  ensurePrintFontsReady,
  loadPortalPrintLogo,
  printLine,
  roundedRect,
} from "./portal-print-system";

export type DiagnosticPdfRow={number:number;name:string;completed:boolean;scoreText:string;percentage:number|null;level:string;weakSkills:string;plan:string};
export type DiagnosticPdfClass={className:string;testTitle:string;rows:DiagnosticPdfRow[];average:number;mastered:number;support:number;topSkill:string;accentColor?:string};
export type DiagnosticPdfOptions={portalName:string;teacherName:string;subject:string;gradeLabel?:string;classes:DiagnosticPdfClass[];fileName:string};

const MAX_ROWS=28;
function chunks<T>(items:T[],size:number){return Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size));}
function levelColors(level:string){if(level==="متقن")return{bg:"#e3f5ea",fg:"#166a49"};if(level==="خطة علاجية")return{bg:"#fde9ec",fg:"#9c3340"};if(level==="يحتاج تحسين")return{bg:"#e8effc",fg:"#345b96"};return{bg:"#f0f3f4",fg:"#647b80"};}
function drawHeader(ctx:CanvasRenderingContext2D,o:DiagnosticPdfOptions,report:DiagnosticPdfClass,accent:string,classIndex:number,logo:HTMLImageElement|null,pageIndex:number,pageCount:number){
  roundedRect(ctx,34,30,PRINT_WIDTH-68,126,24,"#fff","#dce8e4");roundedRect(ctx,PRINT_WIDTH-360,30,326,126,24,accent);
  drawFittedText(ctx,"بوابة تعليمية ذكية",PRINT_WIDTH-332,62,{size:15,min:12,weight:900,color:"#dcefeb",maxWidth:270});
  drawFittedText(ctx,"الاختبارات التشخيصية",PRINT_WIDTH-332,101,{size:26,min:19,weight:900,color:"#fff",maxWidth:275});
  roundedRect(ctx,46,38,114,108,22,"#fff","#d6e3df");if(logo)drawImageContain(ctx,logo,50,42,106,100,4);
  drawFittedText(ctx,o.portalName,178,64,{size:20,min:15,weight:900,color:"#647d81",align:"left",maxWidth:500});
  drawFittedText(ctx,"تقرير القياس التشخيصي والخطة العلاجية",178,108,{size:30,min:21,weight:900,color:"#173d45",align:"left",maxWidth:720});
  roundedRect(ctx,178,132,360,24,12,"#f3f7f6");drawFittedText(ctx,`${report.className}${pageCount>1?` • صفحة ${pageIndex+1}/${pageCount}`:""}`,358,144,{size:11.5,min:9.5,weight:900,color:accent,align:"center",maxWidth:340});
  const meta=[["المعلم",o.teacherName],["المادة",o.subject],["المرحلة",o.gradeLabel||"—"],["الفصل",report.className],["الاختبار",report.testTitle]];const gap=10,margin=34,top=172,boxW=(PRINT_WIDTH-margin*2-gap*4)/5;
  meta.forEach(([label,value],i)=>{const x=PRINT_WIDTH-margin-boxW-i*(boxW+gap);roundedRect(ctx,x,top,boxW,66,13,"#f8fbfa","#dce7e4");drawFixedText(ctx,label,x+boxW-14,top+20,{size:11,weight:900,color:"#859598",maxWidth:boxW-28});drawFittedText(ctx,value,x+boxW-14,top+45,{size:15,min:10,weight:900,color:"#21464c",maxWidth:boxW-28});});
  const completed=report.rows.filter(row=>row.completed).length;const completion=report.rows.length?Math.round(completed/report.rows.length*100):0;const summary=[["طلاب الفصل",report.rows.length],["أدوا الاختبار",completed],["متوسط الفصل",`${report.average}%`],["متقنون",report.mastered],["خطة علاجية",report.support],["إنجاز الاختبار",`${completion}%`]] as const;const sw=(PRINT_WIDTH-68-gap*5)/6;
  summary.forEach(([label,value],i)=>{const x=PRINT_WIDTH-34-sw-i*(sw+gap);roundedRect(ctx,x,252,sw,62,13,i===2||i===3?"#eaf6f1":"#f7faf9","#dfe8e6");drawFixedText(ctx,value,x+sw/2,272,{size:18,weight:900,color:i===2||i===3?"#216c4c":"#244b51",align:"center",maxWidth:sw-20});drawFixedText(ctx,label,x+sw/2,296,{size:10.5,weight:900,color:"#758b8e",align:"center"});});
}
function drawTable(ctx:CanvasRenderingContext2D,rows:DiagnosticPdfRow[],accent:string){
  const x=34,top=332,w=PRINT_WIDTH-68,bottom=PRINT_HEIGHT-100,headerH=54;const rowH=Math.floor((bottom-top-headerH)/Math.max(rows.length,18));
  const widths=[54,300,110,105,95,150,300,478];const labels=["م","اسم الطالب","الحالة","الدرجة","النسبة","المستوى","المهارات الضعيفة","الخطة المختصرة"];
  roundedRect(ctx,x,top,w,bottom-top,14,"#fff","#cbdad6");ctx.save();ctx.beginPath();ctx.rect(x,top,w,bottom-top);ctx.clip();ctx.fillStyle=accent;ctx.fillRect(x,top,w,headerH);let cursor=x+w;
  labels.forEach((label,i)=>{const ww=widths[i];drawFittedText(ctx,label,cursor-ww/2,top+headerH/2,{size:11.5,min:8.5,weight:900,color:"#fff",align:"center",maxWidth:ww-10});cursor-=ww;printLine(ctx,cursor,top,cursor,bottom,"rgba(255,255,255,.25)",1);});
  rows.forEach((row,index)=>{const y=top+headerH+index*rowH;ctx.fillStyle=index%2?"#f8fbfa":"#fff";ctx.fillRect(x,y,w,rowH);printLine(ctx,x,y+rowH,x+w,y+rowH,"#e4ecea");let r=x+w;const fixed=(width:number,value:unknown,size=10.5,weight=750,color?:string)=>{drawFixedText(ctx,value,r-width/2,y+rowH/2,{size,weight,color,align:"center",maxWidth:width-10});r-=width;printLine(ctx,r,y,r,y+rowH);};
    fixed(widths[0],row.number,11,900);
    drawFixedText(ctx,row.name,r-12,y+rowH/2,{size:STUDENT_NAME_FONT_SIZE,weight:800,maxWidth:widths[1]-24});r-=widths[1];printLine(ctx,r,y,r,y+rowH);
    fixed(widths[2],row.completed?"تم":"لم يعمل",10.5,900,row.completed?"#1f6e48":"#8a651a");fixed(widths[3],row.scoreText,10.5,800);fixed(widths[4],row.percentage===null?"—":`${row.percentage}%`,10.5,900,accent);
    const style=levelColors(row.level);const pillH=Math.max(14,Math.min(27,rowH-6));roundedRect(ctx,r-widths[5]+18,y+(rowH-pillH)/2,widths[5]-36,pillH,pillH/2,style.bg);drawFixedText(ctx,row.level,r-widths[5]/2,y+rowH/2,{size:9.5,weight:900,color:style.fg,align:"center",maxWidth:widths[5]-46});r-=widths[5];printLine(ctx,r,y,r,y+rowH);
    drawFixedText(ctx,row.weakSkills,r-10,y+rowH/2,{size:9.5,weight:700,color:"#526c77",maxWidth:widths[6]-20});r-=widths[6];printLine(ctx,r,y,r,y+rowH);
    drawFixedText(ctx,row.plan,r-10,y+rowH/2,{size:9.2,weight:700,color:"#526c77",maxWidth:widths[7]-20});r-=widths[7];
  });ctx.restore();
}
function drawFooter(ctx:CanvasRenderingContext2D,o:DiagnosticPdfOptions,report:DiagnosticPdfClass,accent:string,pageIndex:number,pageCount:number){const y=PRINT_HEIGHT-64;printLine(ctx,34,y-20,PRINT_WIDTH-34,y-20,"#c8d7d3",1.3);drawFixedText(ctx,"اعتماد المعلم: __________________________",PRINT_WIDTH-34,y,{size:12,weight:800,color:"#647b80",maxWidth:450});drawFixedText(ctx,`صفحة ${pageIndex+1} من ${pageCount}`,PRINT_WIDTH/2,y,{size:11.5,weight:900,color:"#647b80",align:"center"});drawFixedText(ctx,`${report.className} • ${report.topSkill}`,34,y,{size:11,weight:800,color:accent,align:"left",maxWidth:520});}
function render(o:DiagnosticPdfOptions,report:DiagnosticPdfClass,classIndex:number,rows:DiagnosticPdfRow[],logo:HTMLImageElement|null,pageIndex:number,pageCount:number){const {canvas,ctx}=createPrintCanvas();const accent=report.accentColor||PRINT_ACCENTS[classIndex%PRINT_ACCENTS.length]||PRINT_ACCENTS[0];drawHeader(ctx,o,report,accent,classIndex,logo,pageIndex,pageCount);drawTable(ctx,rows,accent);drawFooter(ctx,o,report,accent,pageIndex,pageCount);return canvas;}

export async function downloadDiagnosticsPdfDocument(options:DiagnosticPdfOptions){const classes=options.classes.filter(item=>item.rows.length);if(!classes.length)throw new Error("diagnostics_pdf_no_students");await ensurePrintFontsReady();const logo=await loadPortalPrintLogo();const pages:Array<{report:DiagnosticPdfClass;classIndex:number;rows:DiagnosticPdfRow[];pageIndex:number;pageCount:number}>=[];classes.forEach((report,classIndex)=>{const groups=chunks(report.rows,MAX_ROWS);groups.forEach((rows,pageIndex)=>pages.push({report,classIndex,rows,pageIndex,pageCount:groups.length}));});const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});let studentCount=0;pages.forEach((item,index)=>{const canvas=render(options,item.report,item.classIndex,item.rows,logo,item.pageIndex,item.pageCount);if(index)pdf.addPage("a4","landscape");pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,297,210,undefined,"FAST");studentCount+=item.rows.length;});pdf.save(options.fileName);return{pageCount:pages.length,classCount:classes.length,studentCount};}
