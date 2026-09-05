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

export type AttendanceRangePdfRow={
  number:number;
  name:string;
  present:number;
  absentDates:string[];
  lateDates:string[];
  excusedDates:string[];
  escapedDates:string[];
  attendanceRate:number;
};
export type AttendanceRangePdfClass={className:string;rows:AttendanceRangePdfRow[];days:string[];accentColor?:string};
export type AttendanceRangePdfOptions={portalName:string;teacherName:string;subject:string;from:string;to:string;classes:AttendanceRangePdfClass[];fileName:string};

const MAX_ROWS=30;
function chunks<T>(items:T[],size:number){return Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size));}
function shortDate(value:string){const p=value.split("-");return p.length===3?`${p[2]}/${p[1]}`:value;}
function dates(values:string[]){return values.length?values.map(shortDate).join("، "):"—";}
function metrics(report:AttendanceRangePdfClass){const totalAbs=report.rows.reduce((s,r)=>s+r.absentDates.length,0);const totalLate=report.rows.reduce((s,r)=>s+r.lateDates.length,0);const totalExc=report.rows.reduce((s,r)=>s+r.excusedDates.length,0);const avg=report.rows.length?Math.round(report.rows.reduce((s,r)=>s+r.attendanceRate,0)/report.rows.length):0;return{totalAbs,totalLate,totalExc,avg};}
function drawHeader(ctx:CanvasRenderingContext2D,o:AttendanceRangePdfOptions,report:AttendanceRangePdfClass,accent:string,classIndex:number,logo:HTMLImageElement|null,pageIndex:number,pageCount:number){
  roundedRect(ctx,34,30,PRINT_WIDTH-68,126,24,"#fff","#dce8e4");roundedRect(ctx,PRINT_WIDTH-360,30,326,126,24,accent);
  drawFittedText(ctx,"بوابة تعليمية ذكية",PRINT_WIDTH-332,62,{size:15,min:12,weight:900,color:"#dcefeb",maxWidth:270});
  drawFittedText(ctx,"سجل المتابعة الشهري",PRINT_WIDTH-332,101,{size:27,min:20,weight:900,color:"#fff",maxWidth:275});
  roundedRect(ctx,46,38,114,108,22,"#fff","#d6e3df");if(logo)drawImageContain(ctx,logo,50,42,106,100,4);
  drawFittedText(ctx,o.portalName,178,64,{size:20,min:15,weight:900,color:"#647d81",align:"left",maxWidth:500});
  drawFittedText(ctx,"تقرير الحضور والانضباط للفترة",178,108,{size:31,min:23,weight:900,color:"#173d45",align:"left",maxWidth:690});
  roundedRect(ctx,178,132,310,24,12,"#f3f7f6");
  drawFittedText(ctx,`${report.className}${pageCount>1?` • صفحة ${pageIndex+1}/${pageCount}`:""}`,333,144,{size:11.5,min:9.5,weight:900,color:accent,align:"center",maxWidth:290});
  const meta=[["المعلم",o.teacherName],["المادة",o.subject],["الفصل",report.className],["الفترة",`${o.from} — ${o.to}`],["أيام التحضير",report.days.length]];const gap=10,margin=34,top=172,boxW=(PRINT_WIDTH-margin*2-gap*4)/5;
  meta.forEach(([label,value],i)=>{const x=PRINT_WIDTH-margin-boxW-i*(boxW+gap);roundedRect(ctx,x,top,boxW,66,13,"#f8fbfa","#dce7e4");drawFixedText(ctx,label,x+boxW-14,top+20,{size:11,weight:900,color:"#859598",maxWidth:boxW-28});drawFittedText(ctx,value,x+boxW-14,top+45,{size:15,min:10.5,weight:900,color:"#21464c",maxWidth:boxW-28});});
  const m=metrics(report);const summary=[["طلاب الفصل",report.rows.length],["متوسط الحضور",`${m.avg}%`],["الغياب",m.totalAbs],["التأخير",m.totalLate],["الاستئذان",m.totalExc]] as const;const sw=(PRINT_WIDTH-68-gap*4)/5;
  summary.forEach(([label,value],i)=>{const x=PRINT_WIDTH-34-sw-i*(sw+gap);const good=i===1;roundedRect(ctx,x,252,sw,62,13,good?"#eaf6f1":"#f7faf9","#dfe8e6");drawFixedText(ctx,value,x+sw/2,272,{size:18,weight:900,color:good?"#216c4c":"#244b51",align:"center",maxWidth:sw-20});drawFixedText(ctx,label,x+sw/2,296,{size:10.5,weight:900,color:"#758b8e",align:"center"});});
}
function drawTable(ctx:CanvasRenderingContext2D,rows:AttendanceRangePdfRow[],accent:string){
  const x=34,top=332,w=PRINT_WIDTH-68,bottom=PRINT_HEIGHT-100,headerH=54;const rowH=Math.floor((bottom-top-headerH)/Math.max(rows.length,20));
  const widths=[60,315,90,245,220,220,220,110];const labels=["م","اسم الطالب","حضور","تواريخ الغياب","تواريخ التأخير","تواريخ الاستئذان","تواريخ الهروب","النسبة"];
  roundedRect(ctx,x,top,w,bottom-top,14,"#fff","#cbdad6");ctx.save();ctx.beginPath();ctx.rect(x,top,w,bottom-top);ctx.clip();ctx.fillStyle=accent;ctx.fillRect(x,top,w,headerH);let cursor=x+w;
  labels.forEach((label,i)=>{const ww=widths[i];drawFixedText(ctx,label,cursor-ww/2,top+headerH/2,{size:11.5,weight:900,color:"#fff",align:"center",maxWidth:ww-10});cursor-=ww;printLine(ctx,cursor,top,cursor,bottom,"rgba(255,255,255,.25)",1);});
  rows.forEach((row,index)=>{const y=top+headerH+index*rowH;ctx.fillStyle=index%2?"#f8fbfa":"#fff";ctx.fillRect(x,y,w,rowH);printLine(ctx,x,y+rowH,x+w,y+rowH,"#e4ecea");let r=x+w;const values=[row.number,row.name,row.present,dates(row.absentDates),dates(row.lateDates),dates(row.excusedDates),dates(row.escapedDates),`${row.attendanceRate}%`];values.forEach((value,i)=>{const ww=widths[i];const isName=i===1;const isRate=i===7;if(isName)drawFixedText(ctx,value,r-12,y+rowH/2,{size:STUDENT_NAME_FONT_SIZE,weight:800,maxWidth:ww-24});else drawFixedText(ctx,value,r-ww/2,y+rowH/2,{size:i>=3&&i<=6?9.2:11,weight:isRate?900:750,color:isRate?accent:undefined,align:"center",maxWidth:ww-10});r-=ww;printLine(ctx,r,y,r,y+rowH);});});
  ctx.restore();
}
function drawFooter(ctx:CanvasRenderingContext2D,o:AttendanceRangePdfOptions,report:AttendanceRangePdfClass,accent:string,pageIndex:number,pageCount:number){const y=PRINT_HEIGHT-64;printLine(ctx,34,y-20,PRINT_WIDTH-34,y-20,"#c8d7d3",1.3);drawFixedText(ctx,"اعتماد المعلم: __________________________",PRINT_WIDTH-34,y,{size:12,weight:800,color:"#647b80",maxWidth:450});drawFixedText(ctx,`صفحة ${pageIndex+1} من ${pageCount}`,PRINT_WIDTH/2,y,{size:11.5,weight:900,color:"#647b80",align:"center",maxWidth:220});drawFixedText(ctx,`${report.className} • ${o.from} إلى ${o.to}`,34,y,{size:11.5,weight:900,color:accent,align:"left",maxWidth:520});}
function render(o:AttendanceRangePdfOptions,report:AttendanceRangePdfClass,classIndex:number,rows:AttendanceRangePdfRow[],logo:HTMLImageElement|null,pageIndex:number,pageCount:number){const {canvas,ctx}=createPrintCanvas();const accent=report.accentColor||PRINT_ACCENTS[classIndex%PRINT_ACCENTS.length]||PRINT_ACCENTS[0];drawHeader(ctx,o,report,accent,classIndex,logo,pageIndex,pageCount);drawTable(ctx,rows,accent);drawFooter(ctx,o,report,accent,pageIndex,pageCount);return canvas;}

export async function downloadAttendanceRangePdfDocument(options:AttendanceRangePdfOptions){
  const classes=options.classes.filter(item=>item.rows.length&&item.days.length);if(!classes.length)throw new Error("attendance_range_pdf_no_students");
  await ensurePrintFontsReady();const logo=await loadPortalPrintLogo();
  const pages:Array<{report:AttendanceRangePdfClass;classIndex:number;rows:AttendanceRangePdfRow[];pageIndex:number;pageCount:number}>=[];
  classes.forEach((report,classIndex)=>{const groups=chunks(report.rows,MAX_ROWS);groups.forEach((rows,pageIndex)=>pages.push({report,classIndex,rows,pageIndex,pageCount:groups.length}));});
  const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});let studentCount=0;
  pages.forEach((item,index)=>{const canvas=render(options,item.report,item.classIndex,item.rows,logo,item.pageIndex,item.pageCount);if(index)pdf.addPage("a4","landscape");pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,297,210,undefined,"FAST");studentCount+=item.rows.length;});
  pdf.save(options.fileName);return{pageCount:pages.length,classCount:classes.length,studentCount};
}
