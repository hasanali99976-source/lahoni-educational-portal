"use client";

import { jsPDF } from "jspdf";
import {
  PRINT_ACCENTS,
  PRINT_HEIGHT,
  PRINT_WIDTH,
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

const DEFAULT_ACCENT="#0b7c74";

function statusColors(status:string){
  if(status==="حاضر")return{bg:"#e4f5ec",fg:"#1d7048"};
  if(status==="غائب")return{bg:"#fdebed",fg:"#a33b48"};
  if(status==="متأخر")return{bg:"#fff1d1",fg:"#8a651a"};
  if(status==="مستأذن")return{bg:"#e8effb",fg:"#365b94"};
  return{bg:"#f0e9fc",fg:"#71509a"};
}

function drawHeader(ctx:CanvasRenderingContext2D,options:AttendancePdfDocumentOptions,report:AttendancePdfClass,accent:string,logo:HTMLImageElement|null){
  roundedRect(ctx,34,24,PRINT_WIDTH-68,128,22,"#ffffff","#d8e6e2");
  ctx.fillStyle=accent;ctx.fillRect(34,24,PRINT_WIDTH-68,13);
  roundedRect(ctx,48,42,116,96,17,"#ffffff","#d6e3df"); if(logo) drawImageContain(ctx,logo,54,48,104,84,2);
  drawFittedText(ctx,options.portalName,182,59,{size:23,weight:900,color:"#5b747b",align:"left",maxWidth:540});
  drawFittedText(ctx,"سجل المتابعة الأكاديمي",182,98,{size:34,weight:900,color:"#153b49",align:"left",maxWidth:760});
  drawFittedText(ctx,"حضور وانضباط • صفحة مستقلة لكل فصل",182,132,{size:18,weight:800,color:"#6c8187",align:"left",maxWidth:730});
  roundedRect(ctx,PRINT_WIDTH-390,44,324,88,18,accent);
  drawFixedText(ctx,"الحضور اليومي",PRINT_WIDTH-91,73,{size:27,weight:900,color:"#fff",maxWidth:270});
  drawFixedText(ctx,report.className,PRINT_WIDTH-91,109,{size:20,weight:900,color:"#e7f7f4",maxWidth:270});

  const meta=[["المعلم",options.teacherName],["المادة",options.subject],["الفصل",report.className],["التاريخ",options.date],["الهجري",options.hijriDate]];
  const gap=10,margin=34,top=166,boxW=(PRINT_WIDTH-margin*2-gap*4)/5;
  meta.forEach(([label,value],index)=>{
    const x=PRINT_WIDTH-margin-boxW-index*(boxW+gap);
    roundedRect(ctx,x,top,boxW,70,13,"#f7faf9","#dce7e4");
    drawFixedText(ctx,label,x+boxW-14,top+21,{size:14,weight:850,color:"#7a9095",maxWidth:boxW-28});
    drawFittedText(ctx,value,x+boxW-14,top+49,{size:19,weight:900,color:"#21464c",maxWidth:boxW-28});
  });

  const total=report.rows.length||1;
  const rate=Math.round(((report.counts.present+report.counts.late+report.counts.excused)/total)*100);
  const summary=[["طلاب الفصل",report.rows.length,"#f2f6f5","#244b51"],["نسبة الالتزام",`${rate}%`,"#e6f5ed","#1f6e48"],["غائب",report.counts.absent,"#fdecee","#a33b48"],["متأخر",report.counts.late,"#fff2d7","#8a651a"],["مستأذن",report.counts.excused,"#eaf0fb","#365b94"],["هروب",report.counts.escaped,"#f0eafd","#71509a"]] as const;
  const sw=(PRINT_WIDTH-68-gap*5)/6;
  summary.forEach(([label,value,bg,fg],index)=>{const x=PRINT_WIDTH-34-sw-index*(sw+gap);roundedRect(ctx,x,250,sw,64,13,bg,"#dfe8e6");drawFixedText(ctx,value,x+sw/2,272,{size:23,weight:900,color:fg,align:"center",maxWidth:sw-18});drawFixedText(ctx,label,x+sw/2,299,{size:13.5,weight:850,color:fg,align:"center"});});
}

function drawTable(ctx:CanvasRenderingContext2D,rows:AttendancePdfRow[],accent:string){
  const x=34,top=330,w=PRINT_WIDTH-68,bottom=PRINT_HEIGHT-88,headerH=56;
  const available=bottom-top-headerH;
  const rowH=Math.max(12.5,available/Math.max(rows.length,1));
  const dense=rows.length>=38;
  const compact=rows.length>=32;
  const nameSize=dense?16.5:compact?18.5:21.5;
  const cellSize=dense?14.5:compact?16:18;
  const numW=70,statusW=220,noteW=292,nameW=w-numW-statusW-noteW;
  roundedRect(ctx,x,top,w,bottom-top,14,"#fff","#cbdad6");
  ctx.save();ctx.beginPath();ctx.rect(x,top,w,bottom-top);ctx.clip();ctx.fillStyle=accent;ctx.fillRect(x,top,w,headerH);
  const cols=[{label:"م",w:numW},{label:"اسم الطالب",w:nameW},{label:"الحالة",w:statusW},{label:"ملاحظة / متابعة",w:noteW}];let cursor=x+w;
  cols.forEach(col=>{const center=cursor-col.w/2;drawFixedText(ctx,col.label,center,top+headerH/2,{size:17.5,weight:900,color:"#fff",align:"center",maxWidth:col.w-12});cursor-=col.w;printLine(ctx,cursor,top,cursor,bottom,"rgba(255,255,255,.28)",1);});
  rows.forEach((row,index)=>{
    const y=top+headerH+index*rowH;ctx.fillStyle=index%2?"#f6faf9":"#fff";ctx.fillRect(x,y,w,rowH);printLine(ctx,x,y+rowH,x+w,y+rowH,"#e0e9e7");let r=x+w;
    drawFixedText(ctx,row.number,r-numW/2,y+rowH/2,{size:cellSize,weight:850,align:"center"});r-=numW;printLine(ctx,r,y,r,y+rowH);
    drawFixedText(ctx,row.name,r-15,y+rowH/2,{size:nameSize,weight:850,maxWidth:nameW-30});r-=nameW;printLine(ctx,r,y,r,y+rowH);
    const style=statusColors(row.status);const pillH=Math.max(18,Math.min(32,rowH-4));roundedRect(ctx,r-statusW+34,y+(rowH-pillH)/2,statusW-68,pillH,pillH/2,style.bg);drawFixedText(ctx,row.status,r-statusW/2,y+rowH/2,{size:cellSize,weight:900,color:style.fg,align:"center",maxWidth:statusW-80});r-=statusW;printLine(ctx,r,y,r,y+rowH);
  });
  ctx.restore();
}

function drawFooter(ctx:CanvasRenderingContext2D,options:AttendancePdfDocumentOptions,report:AttendancePdfClass,accent:string){
  const y=PRINT_HEIGHT-48;printLine(ctx,34,y-20,PRINT_WIDTH-34,y-20,"#c8d7d3",1.4);
  drawFixedText(ctx,"اعتماد المعلم: __________________________",PRINT_WIDTH-34,y,{size:14.5,weight:800,color:"#60777f",maxWidth:470});
  drawFixedText(ctx,"صفحة الفصل كاملة",PRINT_WIDTH/2,y,{size:14.5,weight:900,color:"#60777f",align:"center",maxWidth:220});
  drawFixedText(ctx,`${options.portalName} • ${report.className}`,34,y,{size:14.5,weight:900,color:accent,align:"left",maxWidth:500});
}

function render(options:AttendancePdfDocumentOptions,report:AttendancePdfClass,classIndex:number,logo:HTMLImageElement|null){
  const {canvas,ctx}=createPrintCanvas();
  const accent=report.accentColor||PRINT_ACCENTS[classIndex%PRINT_ACCENTS.length]||DEFAULT_ACCENT;
  drawHeader(ctx,options,report,accent,logo);drawTable(ctx,report.rows,accent);drawFooter(ctx,options,report,accent);return canvas;
}

export async function downloadAttendancePdfDocument(options:AttendancePdfDocumentOptions){
  const classes=options.classes.filter(item=>item.rows.length>0);if(!classes.length)throw new Error("attendance_pdf_no_students");
  await ensurePrintFontsReady();const logo=await loadPortalPrintLogo();
  const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});let studentCount=0;
  classes.forEach((report,index)=>{const canvas=render(options,report,index,logo);if(index)pdf.addPage("a4","landscape");pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,297,210,undefined,"FAST");studentCount+=report.rows.length;});
  pdf.save(options.fileName);return{pageCount:classes.length,studentCount,classCount:classes.length};
}
