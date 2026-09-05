"use client";

import { jsPDF } from "jspdf";

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

const WIDTH=1680,HEIGHT=1188,MAX_ROWS=30;
const ACCENTS=["#0b675f","#365b94","#71509a","#9a5c39","#3b785d","#8a681e","#8b4560","#4a6689"];
function portalFont(){if(typeof window!=="undefined"&&document?.body)return getComputedStyle(document.body).fontFamily||"Arial, sans-serif";return"Arial, sans-serif";}
function chunks<T>(items:T[],size:number){return Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size));}
function shortDate(value:string){const p=value.split("-");return p.length===3?`${p[2]}/${p[1]}`:value;}
function dates(values:string[]){return values.length?values.map(shortDate).join("، "):"—";}
function page(){const canvas=document.createElement("canvas");canvas.width=WIDTH;canvas.height=HEIGHT;const ctx=canvas.getContext("2d");if(!ctx)throw new Error("attendance_range_pdf_canvas_unavailable");ctx.fillStyle="#fff";ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.textBaseline="middle";ctx.direction="rtl";return{canvas,ctx};}
function font(ctx:CanvasRenderingContext2D,size:number,weight=700){ctx.font=`${weight} ${size}px ${portalFont()}`;}
function fit(ctx:CanvasRenderingContext2D,value:string,maxWidth:number,preferred:number,min:number,weight=700){let size=preferred;while(size>min){font(ctx,size,weight);if(ctx.measureText(value).width<=maxWidth)break;size-=.5;}return size;}
function text(ctx:CanvasRenderingContext2D,value:unknown,x:number,y:number,o:{size?:number;min?:number;weight?:number;color?:string;align?:CanvasTextAlign;maxWidth?:number}={}){const raw=String(value??"");const weight=o.weight??700;const size=o.maxWidth?fit(ctx,raw,o.maxWidth,o.size??18,o.min??8,weight):(o.size??18);font(ctx,size,weight);ctx.fillStyle=o.color??"#173d45";ctx.textAlign=o.align??"right";ctx.fillText(raw,x,y);}
function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.4;ctx.stroke();}}
function line(ctx:CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number,color="#d7e2df",width=1.2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
async function loadLogo(){return new Promise<HTMLImageElement|null>(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src="/icons/lahooni-identity-320.jpg";});}
function metrics(report:AttendanceRangePdfClass){const totalAbs=report.rows.reduce((s,r)=>s+r.absentDates.length,0);const totalLate=report.rows.reduce((s,r)=>s+r.lateDates.length,0);const totalExc=report.rows.reduce((s,r)=>s+r.excusedDates.length,0);const avg=report.rows.length?Math.round(report.rows.reduce((s,r)=>s+r.attendanceRate,0)/report.rows.length):0;return{totalAbs,totalLate,totalExc,avg};}
function drawHeader(ctx:CanvasRenderingContext2D,o:AttendanceRangePdfOptions,report:AttendanceRangePdfClass,accent:string,classIndex:number,logo:HTMLImageElement|null,pageIndex:number,pageCount:number){
  rounded(ctx,34,30,WIDTH-68,126,24,"#fff","#dce8e4");rounded(ctx,WIDTH-360,30,326,126,24,accent);
  text(ctx,"بوابة تعليمية ذكية",WIDTH-332,62,{size:15,weight:900,color:"#dcefeb",maxWidth:270});text(ctx,"سجل المتابعة الشهري",WIDTH-332,101,{size:27,min:20,weight:900,color:"#fff",maxWidth:275});
  rounded(ctx,50,42,100,100,22,"#fff","#d6e3df");if(logo)ctx.drawImage(logo,58,50,84,84);
  text(ctx,o.portalName,170,64,{size:19,weight:900,color:"#647d81",align:"left",maxWidth:500});text(ctx,"تقرير الحضور والانضباط للفترة",170,108,{size:30,min:22,weight:900,color:"#173d45",align:"left",maxWidth:680});
  rounded(ctx,170,132,300,24,12,"#f3f7f6");text(ctx,`${report.className}${pageCount>1?` • صفحة ${pageIndex+1}/${pageCount}`:""}`,320,144,{size:11.5,weight:900,color:accent,align:"center",maxWidth:280});
  const meta=[["المعلم",o.teacherName],["المادة",o.subject],["الفصل",report.className],["الفترة",`${o.from} — ${o.to}`],["أيام التحضير",report.days.length]];const gap=10,margin=34,top=172,boxW=(WIDTH-margin*2-gap*4)/5;
  meta.forEach(([label,value],i)=>{const x=WIDTH-margin-boxW-i*(boxW+gap);rounded(ctx,x,top,boxW,66,13,"#f8fbfa","#dce7e4");text(ctx,label,x+boxW-14,top+20,{size:11,weight:900,color:"#859598",maxWidth:boxW-28});text(ctx,value,x+boxW-14,top+45,{size:15,min:9.5,weight:900,color:"#21464c",maxWidth:boxW-28});});
  const m=metrics(report);const summary=[["طلاب الفصل",report.rows.length],["متوسط الحضور",`${m.avg}%`],["الغياب",m.totalAbs],["التأخير",m.totalLate],["الاستئذان",m.totalExc]] as const;const sw=(WIDTH-68-gap*4)/5;summary.forEach(([label,value],i)=>{const x=WIDTH-34-sw-i*(sw+gap);const good=i===1;rounded(ctx,x,252,sw,62,13,good?"#eaf6f1":"#f7faf9","#dfe8e6");text(ctx,value,x+sw/2,272,{size:18,min:11,weight:900,color:good?"#216c4c":"#244b51",align:"center",maxWidth:sw-20});text(ctx,label,x+sw/2,296,{size:10.5,weight:900,color:"#758b8e",align:"center"});});
}
function drawTable(ctx:CanvasRenderingContext2D,rows:AttendanceRangePdfRow[],accent:string){
  const x=34,top=332,w=WIDTH-68,bottom=HEIGHT-100,headerH=54;const rowH=Math.floor((bottom-top-headerH)/Math.max(rows.length,20));const compact=rows.length>25;
  const widths=[60,315,90,245,220,220,220,110];const labels=["م","اسم الطالب","حضور","تواريخ الغياب","تواريخ التأخير","تواريخ الاستئذان","تواريخ الهروب","النسبة"];
  rounded(ctx,x,top,w,bottom-top,14,"#fff","#cbdad6");ctx.save();ctx.beginPath();ctx.rect(x,top,w,bottom-top);ctx.clip();ctx.fillStyle=accent;ctx.fillRect(x,top,w,headerH);let cursor=x+w;
  labels.forEach((label,i)=>{const ww=widths[i];text(ctx,label,cursor-ww/2,top+headerH/2,{size:12,min:8.5,weight:900,color:"#fff",align:"center",maxWidth:ww-10});cursor-=ww;line(ctx,cursor,top,cursor,bottom,"rgba(255,255,255,.25)",1);});
  rows.forEach((row,index)=>{const y=top+headerH+index*rowH;ctx.fillStyle=index%2?"#f8fbfa":"#fff";ctx.fillRect(x,y,w,rowH);line(ctx,x,y+rowH,x+w,y+rowH,"#e4ecea");let r=x+w;const values=[row.number,row.name,row.present,dates(row.absentDates),dates(row.lateDates),dates(row.excusedDates),dates(row.escapedDates),`${row.attendanceRate}%`];values.forEach((value,i)=>{const ww=widths[i];const isName=i===1;const isRate=i===7;if(isName)text(ctx,value,r-12,y+rowH/2,{size:compact?10.5:12.5,min:8.5,weight:900,maxWidth:ww-24});else text(ctx,value,r-ww/2,y+rowH/2,{size:compact?8.8:10.5,min:7.2,weight:isRate?900:750,color:isRate?accent:undefined,align:"center",maxWidth:ww-10});r-=ww;line(ctx,r,y,r,y+rowH);});
  });ctx.restore();
}
function drawFooter(ctx:CanvasRenderingContext2D,o:AttendanceRangePdfOptions,report:AttendanceRangePdfClass,accent:string,pageIndex:number,pageCount:number){const y=HEIGHT-64;line(ctx,34,y-20,WIDTH-34,y-20,"#c8d7d3",1.3);text(ctx,"اعتماد المعلم: __________________________",WIDTH-34,y,{size:12,weight:800,color:"#647b80",maxWidth:450});text(ctx,`صفحة ${pageIndex+1} من ${pageCount}`,WIDTH/2,y,{size:11.5,weight:900,color:"#647b80",align:"center",maxWidth:220});text(ctx,`${report.className} • ${o.from} إلى ${o.to}`,34,y,{size:11.5,min:9,weight:900,color:accent,align:"left",maxWidth:520});}
function render(o:AttendanceRangePdfOptions,report:AttendanceRangePdfClass,classIndex:number,rows:AttendanceRangePdfRow[],logo:HTMLImageElement|null,pageIndex:number,pageCount:number){const {canvas,ctx}=page();const accent=report.accentColor||ACCENTS[classIndex%ACCENTS.length]||ACCENTS[0];drawHeader(ctx,o,report,accent,classIndex,logo,pageIndex,pageCount);drawTable(ctx,rows,accent);drawFooter(ctx,o,report,accent,pageIndex,pageCount);return canvas;}

export async function downloadAttendanceRangePdfDocument(options:AttendanceRangePdfOptions){
  const classes=options.classes.filter(item=>item.rows.length&&item.days.length);if(!classes.length)throw new Error("attendance_range_pdf_no_students");if(document.fonts?.ready)await document.fonts.ready;const logo=await loadLogo();
  const pages:Array<{report:AttendanceRangePdfClass;classIndex:number;rows:AttendanceRangePdfRow[];pageIndex:number;pageCount:number}>=[];classes.forEach((report,classIndex)=>{const groups=chunks(report.rows,MAX_ROWS);groups.forEach((rows,pageIndex)=>pages.push({report,classIndex,rows,pageIndex,pageCount:groups.length}));});
  const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});let studentCount=0;pages.forEach((item,index)=>{const canvas=render(options,item.report,item.classIndex,item.rows,logo,item.pageIndex,item.pageCount);if(index)pdf.addPage("a4","landscape");pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,297,210,undefined,"FAST");studentCount+=item.rows.length;});
  pdf.save(options.fileName);return{pageCount:pages.length,classCount:classes.length,studentCount};
}
