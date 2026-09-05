"use client";

import { jsPDF } from "jspdf";
import {
  PRINT_ACCENTS, PRINT_HEIGHT, PRINT_WIDTH, STUDENT_NAME_FONT_SIZE,
  createPrintCanvas, drawFittedText, drawFixedText, drawImageContain,
  ensurePrintFontsReady, loadPortalPrintLogo, printLine, roundedRect,
} from "./portal-print-system";

export type AttendanceRangePdfRow={number:number;name:string;present:number;absentDates:string[];lateDates:string[];excusedDates:string[];escapedDates:string[];attendanceRate:number};
export type AttendanceRangePdfClass={className:string;rows:AttendanceRangePdfRow[];days:string[];accentColor?:string};
export type AttendanceRangePdfOptions={portalName:string;teacherName:string;subject:string;from:string;to:string;classes:AttendanceRangePdfClass[];fileName:string};

const MAX_ROWS=24;
function chunks<T>(items:T[],size:number){return Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size));}
function shortDate(value:string){const p=value.split("-");return p.length===3?`${p[2]}/${p[1]}`:value;}
function dates(values:string[]){return values.length?values.map(shortDate).join("، "):"—";}
function metrics(report:AttendanceRangePdfClass){const totalAbs=report.rows.reduce((s,r)=>s+r.absentDates.length,0);const totalLate=report.rows.reduce((s,r)=>s+r.lateDates.length,0);const totalExc=report.rows.reduce((s,r)=>s+r.excusedDates.length,0);const avg=report.rows.length?Math.round(report.rows.reduce((s,r)=>s+r.attendanceRate,0)/report.rows.length):0;return{totalAbs,totalLate,totalExc,avg};}
function drawHeader(ctx:CanvasRenderingContext2D,o:AttendanceRangePdfOptions,report:AttendanceRangePdfClass,accent:string,logo:HTMLImageElement|null,pageIndex:number,pageCount:number){
  roundedRect(ctx,34,28,PRINT_WIDTH-68,142,22,"#fff","#d9e6e3");ctx.fillStyle=accent;ctx.fillRect(34,28,PRINT_WIDTH-68,13);
  roundedRect(ctx,48,48,126,106,18,"#fff","#d6e3df");if(logo)drawImageContain(ctx,logo,54,54,114,94,2);
  drawFittedText(ctx,o.portalName,192,70,{size:24,weight:900,color:"#60777f",align:"left",maxWidth:530});drawFittedText(ctx,"تقرير الحضور والانضباط للفترة",192,113,{size:36,weight:900,color:"#153b49",align:"left",maxWidth:770});drawFittedText(ctx,`${o.from} إلى ${o.to}`,192,146,{size:18,weight:800,color:accent,align:"left",maxWidth:520});
  roundedRect(ctx,PRINT_WIDTH-400,52,334,96,18,accent);drawFixedText(ctx,"سجل المتابعة للفترة",PRINT_WIDTH-92,83,{size:27,weight:900,color:"#fff",maxWidth:278});drawFixedText(ctx,`${report.className} • ${pageIndex+1}/${pageCount}`,PRINT_WIDTH-92,122,{size:18,weight:850,color:"#e3f5f2",maxWidth:278});
  const meta=[["المعلم",o.teacherName],["المادة",o.subject],["الفصل",report.className],["الفترة",`${o.from} — ${o.to}`],["أيام التحضير",report.days.length]];const gap=10,margin=34,top=184,boxW=(PRINT_WIDTH-margin*2-gap*4)/5;
  meta.forEach(([label,value],i)=>{const x=PRINT_WIDTH-margin-boxW-i*(boxW+gap);roundedRect(ctx,x,top,boxW,76,13,"#f7faf9","#dce7e4");drawFixedText(ctx,label,x+boxW-14,top+23,{size:15,weight:850,color:"#7a9095",maxWidth:boxW-28});drawFittedText(ctx,value,x+boxW-14,top+53,{size:20,weight:900,color:"#21464c",maxWidth:boxW-28});});
  const m=metrics(report);const summary=[["طلاب الفصل",report.rows.length],["متوسط الحضور",`${m.avg}%`],["الغياب",m.totalAbs],["التأخير",m.totalLate],["الاستئذان",m.totalExc]] as const;const sw=(PRINT_WIDTH-68-gap*4)/5;
  summary.forEach(([label,value],i)=>{const x=PRINT_WIDTH-34-sw-i*(sw+gap);const good=i===1;roundedRect(ctx,x,276,sw,70,13,good?"#e6f5ed":"#f7faf9","#dfe8e6");drawFixedText(ctx,value,x+sw/2,298,{size:25,weight:900,color:good?"#216c4c":"#244b51",align:"center",maxWidth:sw-20});drawFixedText(ctx,label,x+sw/2,327,{size:14,weight:850,color:"#667d84",align:"center"});});
}
function drawTable(ctx:CanvasRenderingContext2D,rows:AttendanceRangePdfRow[],accent:string){
  const x=34,top=366,w=PRINT_WIDTH-68,bottom=PRINT_HEIGHT-108,headerH=62;const rowH=Math.floor((bottom-top-headerH)/Math.max(rows.length,15));
  const widths=[62,338,92,233,218,218,218,117];const labels=["م","اسم الطالب","حضور","تواريخ الغياب","تواريخ التأخير","تواريخ الاستئذان","تواريخ الهروب","النسبة"];
  roundedRect(ctx,x,top,w,bottom-top,14,"#fff","#cbdad6");ctx.save();ctx.beginPath();ctx.rect(x,top,w,bottom-top);ctx.clip();ctx.fillStyle=accent;ctx.fillRect(x,top,w,headerH);let cursor=x+w;
  labels.forEach((label,i)=>{const ww=widths[i];drawFixedText(ctx,label,cursor-ww/2,top+headerH/2,{size:16.5,weight:900,color:"#fff",align:"center",maxWidth:ww-10});cursor-=ww;printLine(ctx,cursor,top,cursor,bottom,"rgba(255,255,255,.25)",1);});
  rows.forEach((row,index)=>{const y=top+headerH+index*rowH;ctx.fillStyle=index%2?"#f6faf9":"#fff";ctx.fillRect(x,y,w,rowH);printLine(ctx,x,y+rowH,x+w,y+rowH,"#e1e9e7");let r=x+w;const values=[row.number,row.name,row.present,dates(row.absentDates),dates(row.lateDates),dates(row.excusedDates),dates(row.escapedDates),`${row.attendanceRate}%`];values.forEach((value,i)=>{const ww=widths[i];const isName=i===1;const isRate=i===7;if(isName)drawFixedText(ctx,value,r-14,y+rowH/2,{size:STUDENT_NAME_FONT_SIZE,weight:850,maxWidth:ww-28});else drawFixedText(ctx,value,r-ww/2,y+rowH/2,{size:i>=3&&i<=6?15.5:17.5,weight:isRate?900:800,color:isRate?accent:undefined,align:"center",maxWidth:ww-12});r-=ww;printLine(ctx,r,y,r,y+rowH);});});ctx.restore();
}
function drawFooter(ctx:CanvasRenderingContext2D,o:AttendanceRangePdfOptions,report:AttendanceRangePdfClass,accent:string,pageIndex:number,pageCount:number){const y=PRINT_HEIGHT-64;printLine(ctx,34,y-22,PRINT_WIDTH-34,y-22,"#c8d7d3",1.4);drawFixedText(ctx,"اعتماد المعلم: __________________________",PRINT_WIDTH-34,y,{size:15,weight:800,color:"#60777f",maxWidth:470});drawFixedText(ctx,`صفحة ${pageIndex+1} من ${pageCount}`,PRINT_WIDTH/2,y,{size:15,weight:900,color:"#60777f",align:"center",maxWidth:220});drawFixedText(ctx,`${report.className} • ${o.from} إلى ${o.to}`,34,y,{size:15,weight:900,color:accent,align:"left",maxWidth:520});}
function render(o:AttendanceRangePdfOptions,report:AttendanceRangePdfClass,classIndex:number,rows:AttendanceRangePdfRow[],logo:HTMLImageElement|null,pageIndex:number,pageCount:number){const {canvas,ctx}=createPrintCanvas();const accent=report.accentColor||PRINT_ACCENTS[classIndex%PRINT_ACCENTS.length]||PRINT_ACCENTS[0];drawHeader(ctx,o,report,accent,logo,pageIndex,pageCount);drawTable(ctx,rows,accent);drawFooter(ctx,o,report,accent,pageIndex,pageCount);return canvas;}

export async function downloadAttendanceRangePdfDocument(options:AttendanceRangePdfOptions){const classes=options.classes.filter(item=>item.rows.length&&item.days.length);if(!classes.length)throw new Error("attendance_range_pdf_no_students");await ensurePrintFontsReady();const logo=await loadPortalPrintLogo();const pages:Array<{report:AttendanceRangePdfClass;classIndex:number;rows:AttendanceRangePdfRow[];pageIndex:number;pageCount:number}>=[];classes.forEach((report,classIndex)=>{const groups=chunks(report.rows,MAX_ROWS);groups.forEach((rows,pageIndex)=>pages.push({report,classIndex,rows,pageIndex,pageCount:groups.length}));});const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});let studentCount=0;pages.forEach((item,index)=>{const canvas=render(options,item.report,item.classIndex,item.rows,logo,item.pageIndex,item.pageCount);if(index)pdf.addPage("a4","landscape");pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,297,210,undefined,"FAST");studentCount+=item.rows.length;});pdf.save(options.fileName);return{pageCount:pages.length,classCount:classes.length,studentCount};}
