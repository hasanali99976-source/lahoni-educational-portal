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

export type AttendancePdfRow = { number:number; name:string; status:string };
export type AttendancePdfCounts = { present:number; absent:number; late:number; excused:number; escaped:number };
export type AttendancePdfClass = { className:string; rows:AttendancePdfRow[]; counts:AttendancePdfCounts; accentColor?:string };
export type AttendancePdfDocumentOptions = {
  portalName:string;
  teacherName:string;
  subject:string;
  date:string;
  hijriDate:string;
  classes:AttendancePdfClass[];
  fileName:string;
};

const DEFAULT_ACCENT="#0b675f";
const MAX_ROWS_PER_PAGE=38;

function chunks<T>(items:T[],size:number){
  return Array.from({length:Math.ceil(items.length/size)},(_,index)=>items.slice(index*size,(index+1)*size));
}
function statusColors(status:string){
  if(status==="حاضر")return{bg:"#e7f5ec",fg:"#1f6e48"};
  if(status==="غائب")return{bg:"#fdecee",fg:"#a33b48"};
  if(status==="متأخر")return{bg:"#fff3d6",fg:"#8a651a"};
  if(status==="مستأذن")return{bg:"#eaf0fb",fg:"#365b94"};
  return{bg:"#f0eafd",fg:"#71509a"};
}
function drawHeader(ctx:CanvasRenderingContext2D,options:AttendancePdfDocumentOptions,report:AttendancePdfClass,accent:string,classIndex:number,logo:HTMLImageElement|null,pageIndex:number,pageCount:number){
  roundedRect(ctx,34,30,PRINT_WIDTH-68,126,24,"#ffffff","#dce8e4");
  roundedRect(ctx,PRINT_WIDTH-360,30,326,126,24,accent);
  drawFittedText(ctx,"بوابة تعليمية ذكية",PRINT_WIDTH-332,62,{size:15,min:12,weight:900,color:"#dcefeb",maxWidth:270});
  drawFittedText(ctx,"سجل المتابعة الأكاديمي",PRINT_WIDTH-332,101,{size:27,min:20,weight:900,color:"#ffffff",maxWidth:275});

  roundedRect(ctx,46,38,114,108,22,"#ffffff","#d6e3df");
  if(logo) drawImageContain(ctx,logo,50,42,106,100,4);
  drawFittedText(ctx,options.portalName,178,63,{size:20,min:15,weight:900,color:"#5f787d",align:"left",maxWidth:500});
  drawFittedText(ctx,"تقرير الحضور والانضباط اليومي",178,108,{size:31,min:23,weight:900,color:"#173d45",align:"left",maxWidth:690});
  roundedRect(ctx,178,132,260,24,12,"#f3f7f6");
  drawFittedText(ctx,`الفصل ${classIndex+1} من ${options.classes.length}${pageCount>1?` • صفحة ${pageIndex+1}/${pageCount}`:""}`,308,144,{size:11.5,min:9.5,weight:900,color:accent,align:"center",maxWidth:240});

  const meta=[["المعلم",options.teacherName],["المادة",options.subject],["الفصل",report.className],["التاريخ",options.date],["الهجري",options.hijriDate]];
  const gap=10,margin=34,top=172,boxW=(PRINT_WIDTH-margin*2-gap*4)/5;
  meta.forEach(([label,value],index)=>{
    const x=PRINT_WIDTH-margin-boxW-index*(boxW+gap);
    roundedRect(ctx,x,top,boxW,66,13,"#f8fbfa","#dce7e4");
    drawFixedText(ctx,label,x+boxW-14,top+20,{size:11,weight:900,color:"#849598",maxWidth:boxW-28});
    drawFittedText(ctx,value,x+boxW-14,top+45,{size:16,min:11,weight:900,color:"#21464c",maxWidth:boxW-28});
  });

  const total=report.rows.length||1;
  const rate=Math.round(((report.counts.present+report.counts.late+report.counts.excused)/total)*100);
  const summary=[
    ["طلاب الفصل",report.rows.length,"#f2f6f5","#244b51"],["نسبة الالتزام",`${rate}%`,"#e8f5ef","#1f6e48"],["غائب",report.counts.absent,"#fdecee","#a33b48"],["متأخر",report.counts.late,"#fff3d6","#8a651a"],["مستأذن",report.counts.excused,"#eaf0fb","#365b94"],["هروب",report.counts.escaped,"#f0eafd","#71509a"],
  ] as const;
  const sw=(PRINT_WIDTH-68-gap*5)/6;
  summary.forEach(([label,value,bg,fg],index)=>{
    const x=PRINT_WIDTH-34-sw-index*(sw+gap);
    roundedRect(ctx,x,252,sw,62,13,bg,"#dfe8e6");
    drawFixedText(ctx,value,x+sw/2,272,{size:20,weight:900,color:fg,align:"center",maxWidth:sw-18});
    drawFixedText(ctx,label,x+sw/2,296,{size:11,weight:900,color:fg,align:"center"});
  });
}
function drawTable(ctx:CanvasRenderingContext2D,rows:AttendancePdfRow[],accent:string){
  const x=34,top=332,w=PRINT_WIDTH-68,bottom=PRINT_HEIGHT-100,headerH=48;
  const rowH=Math.floor((bottom-top-headerH)/Math.max(rows.length,18));
  const numW=74,statusW=220,noteW=350,nameW=w-numW-statusW-noteW;
  roundedRect(ctx,x,top,w,bottom-top,14,"#fff","#cbdad6");
  ctx.save();ctx.beginPath();ctx.rect(x,top,w,bottom-top);ctx.clip();ctx.fillStyle=accent;ctx.fillRect(x,top,w,headerH);
  const cols=[{label:"م",w:numW},{label:"اسم الطالب",w:nameW},{label:"الحالة",w:statusW},{label:"ملاحظة / متابعة",w:noteW}];let cursor=x+w;
  cols.forEach(col=>{
    const center=cursor-col.w/2;
    drawFixedText(ctx,col.label,center,top+headerH/2,{size:14,weight:900,color:"#fff",align:"center",maxWidth:col.w-12});
    cursor-=col.w;printLine(ctx,cursor,top,cursor,bottom,"rgba(255,255,255,.26)",1);
  });
  rows.forEach((row,index)=>{
    const y=top+headerH+index*rowH;
    ctx.fillStyle=index%2?"#f8fbfa":"#fff";ctx.fillRect(x,y,w,rowH);printLine(ctx,x,y+rowH,x+w,y+rowH,"#e4ecea");let r=x+w;
    drawFixedText(ctx,row.number,r-numW/2,y+rowH/2,{size:12,weight:900,align:"center"});r-=numW;printLine(ctx,r,y,r,y+rowH);
    drawFixedText(ctx,row.name,r-14,y+rowH/2,{size:STUDENT_NAME_FONT_SIZE,weight:800,maxWidth:nameW-28});r-=nameW;printLine(ctx,r,y,r,y+rowH);
    const style=statusColors(row.status);const pillH=Math.max(14,Math.min(28,rowH-6));
    roundedRect(ctx,r-statusW+34,y+(rowH-pillH)/2,statusW-68,pillH,pillH/2,style.bg);
    drawFixedText(ctx,row.status,r-statusW/2,y+rowH/2,{size:11,weight:900,color:style.fg,align:"center",maxWidth:statusW-80});r-=statusW;printLine(ctx,r,y,r,y+rowH);
  });
  ctx.restore();
}
function drawFooter(ctx:CanvasRenderingContext2D,options:AttendancePdfDocumentOptions,report:AttendancePdfClass,accent:string,pageIndex:number,pageCount:number){
  const y=PRINT_HEIGHT-64;
  printLine(ctx,34,y-20,PRINT_WIDTH-34,y-20,"#c8d7d3",1.3);
  drawFixedText(ctx,"اعتماد المعلم: __________________________",PRINT_WIDTH-34,y,{size:12,weight:800,color:"#647b80",maxWidth:450});
  drawFixedText(ctx,`صفحة ${pageIndex+1} من ${pageCount}`,PRINT_WIDTH/2,y,{size:11.5,weight:900,color:"#647b80",align:"center",maxWidth:220});
  drawFixedText(ctx,`${options.portalName} • ${report.className}`,34,y,{size:11.5,weight:900,color:accent,align:"left",maxWidth:480});
}
function render(options:AttendancePdfDocumentOptions,report:AttendancePdfClass,classIndex:number,rows:AttendancePdfRow[],logo:HTMLImageElement|null,pageIndex:number,pageCount:number){
  const {canvas,ctx}=createPrintCanvas();
  const accent=report.accentColor||PRINT_ACCENTS[classIndex%PRINT_ACCENTS.length]||DEFAULT_ACCENT;
  drawHeader(ctx,options,report,accent,classIndex,logo,pageIndex,pageCount);
  drawTable(ctx,rows,accent);
  drawFooter(ctx,options,report,accent,pageIndex,pageCount);
  return canvas;
}

export async function downloadAttendancePdfDocument(options:AttendancePdfDocumentOptions){
  const classes=options.classes.filter(item=>item.rows.length>0);
  if(!classes.length)throw new Error("attendance_pdf_no_students");
  await ensurePrintFontsReady();
  const logo=await loadPortalPrintLogo();
  const pages:Array<{report:AttendancePdfClass;classIndex:number;rows:AttendancePdfRow[];pageIndex:number;pageCount:number}>=[];
  classes.forEach((report,classIndex)=>{
    const rowPages=chunks(report.rows,MAX_ROWS_PER_PAGE);
    rowPages.forEach((rows,pageIndex)=>pages.push({report,classIndex,rows,pageIndex,pageCount:rowPages.length}));
  });
  const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});let studentCount=0;
  pages.forEach((page,index)=>{
    const canvas=render(options,page.report,page.classIndex,page.rows,logo,page.pageIndex,page.pageCount);
    if(index)pdf.addPage("a4","landscape");
    pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,297,210,undefined,"FAST");
    studentCount+=page.rows.length;
  });
  pdf.save(options.fileName);
  return{pageCount:pages.length,studentCount,classCount:classes.length};
}
