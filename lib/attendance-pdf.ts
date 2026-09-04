"use client";

import { jsPDF } from "jspdf";

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

const WIDTH=1680;
const HEIGHT=1188;
const DEFAULT_ACCENT="#0b675f";
const CLASS_ACCENTS=["#0b675f","#365b94","#71509a","#9a5c39","#3b785d","#8a681e","#8b4560","#4a6689"];

function activeFontFamily(){
  if(typeof window!=="undefined"&&document?.body){
    const value=getComputedStyle(document.body).fontFamily;
    if(value)return value;
  }
  return "Tajawal, Arial, sans-serif";
}
function canvasPage(){
  const canvas=document.createElement("canvas");canvas.width=WIDTH;canvas.height=HEIGHT;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("attendance_pdf_canvas_unavailable");
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.textBaseline="middle";ctx.direction="rtl";return{canvas,ctx};
}
function font(ctx:CanvasRenderingContext2D,size:number,weight=700){ctx.font=`${weight} ${size}px ${activeFontFamily()}`;}
function fit(ctx:CanvasRenderingContext2D,value:string,maxWidth:number,preferred:number,min:number,weight=700){let size=preferred;while(size>min){font(ctx,size,weight);if(ctx.measureText(value).width<=maxWidth)break;size-=.5;}return size;}
function txt(ctx:CanvasRenderingContext2D,value:unknown,x:number,y:number,options:{size?:number;min?:number;weight?:number;color?:string;align?:CanvasTextAlign;maxWidth?:number}={}){
  const raw=String(value??"");const weight=options.weight??700;const size=options.maxWidth?fit(ctx,raw,options.maxWidth,options.size??18,options.min??10,weight):(options.size??18);font(ctx,size,weight);ctx.fillStyle=options.color??"#173d45";ctx.textAlign=options.align??"right";ctx.fillText(raw,x,y);
}
function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string){
  const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}
}
function line(ctx:CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number,color="#d7e2df",width=1.2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function statusColors(status:string){
  if(status==="حاضر")return{bg:"#e7f5ec",fg:"#1f6e48"};
  if(status==="غائب")return{bg:"#fdecee",fg:"#a33b48"};
  if(status==="متأخر")return{bg:"#fff3d6",fg:"#8a651a"};
  if(status==="مستأذن")return{bg:"#eaf0fb",fg:"#365b94"};
  return{bg:"#f0eafd",fg:"#71509a"};
}
async function loadPortalLogo(){
  return new Promise<HTMLImageElement|null>(resolve=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>resolve(null);
    image.src="/icons/lahooni-identity-320.jpg";
  });
}
function drawHeader(ctx:CanvasRenderingContext2D,options:AttendancePdfDocumentOptions,report:AttendancePdfClass,accent:string,classIndex:number,logo:HTMLImageElement|null){
  rounded(ctx,34,28,WIDTH-68,136,26,"#ffffff","#dce8e4");
  rounded(ctx,WIDTH-376,28,342,136,26,accent);
  txt(ctx,"منصة تعليمية ذكية",WIDTH-348,63,{size:16,weight:900,color:"#dcefeb",maxWidth:285});
  txt(ctx,"سجل المتابعة",WIDTH-348,106,{size:30,min:22,weight:950,color:"#ffffff",maxWidth:285});

  rounded(ctx,48,40,112,112,24,"#ffffff","#d6e3df");
  if(logo)ctx.drawImage(logo,56,48,96,96);
  txt(ctx,options.portalName,178,66,{size:20,weight:950,color:"#5f777c",align:"left",maxWidth:520});
  txt(ctx,"تقرير الحضور والانضباط الأكاديمي",178,111,{size:32,min:23,weight:950,color:"#173d45",align:"left",maxWidth:720});
  rounded(ctx,178,136,214,24,12,"#f3f7f6");txt(ctx,`الفصل ${classIndex+1} من ${options.classes.length}`,285,148,{size:12.5,weight:900,color:accent,align:"center"});

  const meta=[["المعلم",options.teacherName],["المادة",options.subject],["الفصل",report.className],["التاريخ",options.date],["الهجري",options.hijriDate]];
  const gap=10,margin=34,top=180,boxW=(WIDTH-margin*2-gap*4)/5;
  meta.forEach(([label,value],index)=>{const x=WIDTH-margin-boxW-index*(boxW+gap);rounded(ctx,x,top,boxW,64,13,"#f8fbfa","#dce7e4");txt(ctx,label,x+boxW-14,top+19,{size:11.5,weight:900,color:"#849598",maxWidth:boxW-28});txt(ctx,value,x+boxW-14,top+44,{size:16.5,min:11,weight:950,color:"#21464c",maxWidth:boxW-28});});

  const total=report.rows.length||1;const rate=Math.round(((report.counts.present+report.counts.late+report.counts.excused)/total)*100);
  const summary=[
    ["طلاب الفصل",report.rows.length,"#f2f6f5","#244b51"],["نسبة الالتزام",`${rate}%`,"#e8f5ef","#1f6e48"],["غائب",report.counts.absent,"#fdecee","#a33b48"],["متأخر",report.counts.late,"#fff3d6","#8a651a"],["مستأذن",report.counts.excused,"#eaf0fb","#365b94"],["هروب",report.counts.escaped,"#f0eafd","#71509a"],
  ] as const;
  const sw=(WIDTH-68-gap*5)/6;summary.forEach(([label,value,bg,fg],index)=>{const x=WIDTH-34-sw-index*(sw+gap);rounded(ctx,x,258,sw,62,13,bg,"#dfe8e6");txt(ctx,value,x+sw/2,278,{size:20,min:13,weight:950,color:fg,align:"center",maxWidth:sw-18});txt(ctx,label,x+sw/2,302,{size:11,weight:900,color:fg,align:"center"});});
}
function drawTable(ctx:CanvasRenderingContext2D,rows:AttendancePdfRow[],accent:string){
  const x=34,top=338,w=WIDTH-68,bottom=HEIGHT-100,headerH=48;
  const minRows=Math.max(24,rows.length);const rowH=Math.max(14,Math.floor((bottom-top-headerH)/minRows));
  const compact=rows.length>34;const numW=74,statusW=220,noteW=350,nameW=w-numW-statusW-noteW;
  rounded(ctx,x,top,w,bottom-top,14,"#fff","#cbdad6");ctx.save();ctx.beginPath();ctx.rect(x,top,w,bottom-top);ctx.clip();ctx.fillStyle=accent;ctx.fillRect(x,top,w,headerH);
  const cols=[{label:"م",w:numW},{label:"اسم الطالب",w:nameW},{label:"الحالة",w:statusW},{label:"ملاحظة / متابعة",w:noteW}];let cursor=x+w;
  cols.forEach(col=>{const center=cursor-col.w/2;txt(ctx,col.label,center,top+headerH/2,{size:14.5,weight:950,color:"#fff",align:"center",maxWidth:col.w-12});cursor-=col.w;line(ctx,cursor,top,cursor,bottom,"rgba(255,255,255,.26)",1);});
  rows.forEach((row,index)=>{const y=top+headerH+index*rowH;ctx.fillStyle=index%2?"#f8fbfa":"#fff";ctx.fillRect(x,y,w,rowH);line(ctx,x,y+rowH,x+w,y+rowH,"#e4ecea");let r=x+w;
    txt(ctx,row.number,r-numW/2,y+rowH/2,{size:compact?11:13.5,weight:950,align:"center"});r-=numW;line(ctx,r,y,r,y+rowH);
    txt(ctx,row.name,r-14,y+rowH/2,{size:compact?12:14.5,min:10,weight:950,maxWidth:nameW-28});r-=nameW;line(ctx,r,y,r,y+rowH);
    const style=statusColors(row.status);const pillH=Math.max(12,Math.min(28,rowH-6));rounded(ctx,r-statusW+34,y+(rowH-pillH)/2,statusW-68,pillH,pillH/2,style.bg);txt(ctx,row.status,r-statusW/2,y+rowH/2,{size:compact?10.5:12.5,min:9,weight:950,color:style.fg,align:"center",maxWidth:statusW-80});r-=statusW;line(ctx,r,y,r,y+rowH);
  });
  ctx.restore();
}
function drawFooter(ctx:CanvasRenderingContext2D,options:AttendancePdfDocumentOptions,report:AttendancePdfClass,accent:string){
  const y=HEIGHT-64;line(ctx,34,y-20,WIDTH-34,y-20,"#c8d7d3",1.3);
  txt(ctx,"اعتماد المعلم: __________________________",WIDTH-34,y,{size:12.5,weight:850,color:"#647b80",maxWidth:450});
  txt(ctx,"اعتماد الإدارة: __________________________",WIDTH/2,y,{size:12.5,weight:850,color:"#647b80",align:"center",maxWidth:450});
  txt(ctx,`${options.portalName} • ${report.className}`,34,y,{size:12,weight:950,color:accent,align:"left",maxWidth:500});
}
function render(options:AttendancePdfDocumentOptions,report:AttendancePdfClass,index:number,logo:HTMLImageElement|null){
  const {canvas,ctx}=canvasPage();const accent=report.accentColor||CLASS_ACCENTS[index%CLASS_ACCENTS.length]||DEFAULT_ACCENT;drawHeader(ctx,options,report,accent,index,logo);drawTable(ctx,report.rows,accent);drawFooter(ctx,options,report,accent);return canvas;
}

export async function downloadAttendancePdfDocument(options:AttendancePdfDocumentOptions){
  const classes=options.classes.filter(item=>item.rows.length>0);if(!classes.length)throw new Error("attendance_pdf_no_students");if(document.fonts?.ready)await document.fonts.ready;
  const logo=await loadPortalLogo();
  const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});let pageCount=0,studentCount=0;
  classes.forEach((report,index)=>{const canvas=render(options,report,index,logo);if(pageCount)pdf.addPage("a4","landscape");pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,297,210,undefined,"FAST");pageCount+=1;studentCount+=report.rows.length;});
  pdf.save(options.fileName);return{pageCount,studentCount,classCount:classes.length};
}
