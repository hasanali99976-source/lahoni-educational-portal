"use client";

import { ellipsizeFixed, portalPrintFont, STUDENT_NAME_FONT_SIZE } from "./portal-print-system";

export type AttendanceCanvasRow = { number: number; name: string; status: string };
export type GradesCanvasRow = {
  number: number; name: string; attendance: number | string; participation: number | string;
  homework: number | string; unitExam: number | string; total: number | string; notes: string;
};

type AttendanceCanvasOptions = {
  portalName: string; teacherName: string; subject: string; className: string; date: string; hijriDate: string;
  rows: AttendanceCanvasRow[];
  counts: { present: number; absent: number; late: number; excused: number; escaped: number };
};
type GradesCanvasOptions = {
  portalName: string; teacherName?: string; subject: string; stage: string; className: string;
  unitLabel: string; examLabel: string; rows: GradesCanvasRow[];
};

const WIDTH = 1600;
const HEIGHT = 1131;

function canvasContext() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH; canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_context_unavailable");
  context.fillStyle = "#fff"; context.fillRect(0, 0, WIDTH, HEIGHT);
  context.textBaseline = "middle"; context.direction = "rtl";
  return { canvas, context };
}
function rr(c: CanvasRenderingContext2D, x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string){
  r=Math.max(0,Math.min(r,w/2,h/2)); c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); c.fillStyle=fill; c.fill();
  if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}
}
function font(c:CanvasRenderingContext2D,size:number,weight=700){c.font=`${weight} ${size}px ${portalPrintFont()}`;}
function fit(c:CanvasRenderingContext2D,value:string,maxWidth:number,start:number,min:number,weight=700){let s=start;while(s>min){font(c,s,weight);if(c.measureText(value).width<=maxWidth)break;s-=.5;}return s;}
function tx(c:CanvasRenderingContext2D,value:unknown,x:number,y:number,o:{size?:number;minSize?:number;weight?:number;color?:string;align?:CanvasTextAlign;maxWidth?:number}={}){
  const raw=String(value??""); const size=o.maxWidth?fit(c,raw,o.maxWidth,o.size??18,o.minSize??10,o.weight??700):(o.size??18); font(c,size,o.weight??700); c.fillStyle=o.color??"#173b49"; c.textAlign=o.align??"right"; c.fillText(raw,x,y);
}
function studentName(c:CanvasRenderingContext2D,value:unknown,x:number,y:number,maxWidth:number){const raw=String(value??"");font(c,STUDENT_NAME_FONT_SIZE,800);c.fillStyle="#153c49";c.textAlign="right";c.fillText(ellipsizeFixed(c,raw,maxWidth,STUDENT_NAME_FONT_SIZE,800),x,y);}
function ln(c:CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number,color="#d5e2e7",width=1){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function header(c:CanvasRenderingContext2D,title:string,brand:string,subtitle:string){
  const x=28,y=22,w=WIDTH-56,h=105; rr(c,x,y,w,h,22,"#0f4c5a"); rr(c,x+14,y+14,230,36,18,"#f5c34f");
  tx(c,"صفحة واحدة — جميع الطلاب",x+129,y+32,{size:14,weight:900,color:"#173b49",align:"center"});
  tx(c,title,x+28,y+76,{size:31,minSize:24,weight:900,color:"#fff",align:"left",maxWidth:600});
  tx(c,brand,x+w-28,y+34,{size:14,weight:800,color:"#c9e2e8",maxWidth:610});
  tx(c,subtitle,x+w-28,y+72,{size:27,minSize:18,weight:900,color:"#fff",maxWidth:610});
}
function meta(c:CanvasRenderingContext2D,items:Array<{label:string;value:string}>,y:number){
  const m=28,g=10,w=(WIDTH-m*2-g*(items.length-1))/items.length;
  items.forEach((it,i)=>{const x=WIDTH-m-w-i*(w+g);rr(c,x,y,w,72,14,"#f7fafb","#cedde3");tx(c,it.label,x+w-14,y+22,{size:12,weight:800,color:"#70858e",maxWidth:w-28});tx(c,it.value||"—",x+w-14,y+50,{size:18,minSize:11,weight:900,maxWidth:w-28});});
}
function summary(c:CanvasRenderingContext2D,items:Array<{label:string;value:number;fill:string;color:string}>,y:number){
  const m=28,g=10,w=(WIDTH-m*2-g*(items.length-1))/items.length;
  items.forEach((it,i)=>{const x=WIDTH-m-w-i*(w+g);rr(c,x,y,w,64,14,it.fill,"#d5e2e7");tx(c,it.value,x+w/2,y+24,{size:22,weight:900,color:it.color,align:"center"});tx(c,it.label,x+w/2,y+48,{size:12,weight:900,color:it.color,align:"center"});});
}
function footer(c:CanvasRenderingContext2D,left:string,center:string,right:string){const y=HEIGHT-34;ln(c,28,y-12,WIDTH-28,y-12,"#b9cbd1",1.5);tx(c,left,28,y,{size:12,weight:900,color:"#2d5662",align:"left",maxWidth:500});tx(c,center,WIDTH/2,y,{size:12,weight:800,color:"#6a7f88",align:"center",maxWidth:500});tx(c,right,WIDTH-28,y,{size:12,weight:900,color:"#0d6b52",maxWidth:500});}
function statusStyle(status:string){if(status==="حاضر")return{fill:"#dff4e7",color:"#13643d"};if(status==="غائب")return{fill:"#fde6e9",color:"#a72c39"};if(status==="متأخر")return{fill:"#fff0c9",color:"#8a5a05"};if(status==="مستأذن")return{fill:"#e3edff",color:"#2457a1"};return{fill:"#eee4ff",color:"#6239a4"};}

export function renderAttendanceClassCanvas(o:AttendanceCanvasOptions){
  const {canvas,context:c}=canvasContext(); header(c,"تقرير الحضور اليومي",o.portalName,"سجل الحضور والمتابعة اليومية");
  meta(c,[{label:"المعلم",value:o.teacherName},{label:"المادة",value:o.subject},{label:"الفصل",value:o.className},{label:"التاريخ",value:o.date},{label:"التاريخ الهجري",value:o.hijriDate}],142);
  summary(c,[{label:"إجمالي الطلاب",value:o.rows.length,fill:"#edf4f6",color:"#173b49"},{label:"حاضر",value:o.counts.present,fill:"#e0f3e7",color:"#13643d"},{label:"غائب",value:o.counts.absent,fill:"#fde6e9",color:"#a72c39"},{label:"متأخر",value:o.counts.late,fill:"#fff0c9",color:"#8a5a05"},{label:"مستأذن",value:o.counts.excused,fill:"#e3edff",color:"#2457a1"},{label:"هروب",value:o.counts.escaped,fill:"#eee4ff",color:"#6239a4"}],226);
  const top=306,bottom=HEIGHT-64,m=28,g=16,count=o.rows.length<=18?1:2,rpc=Math.ceil(o.rows.length/count),cw=(WIDTH-m*2-g*(count-1))/count,hh=42,rh=Math.floor((bottom-top-hh)/Math.max(1,rpc));
  for(let col=0;col<count;col++){
    const x=WIDTH-m-cw-col*(cw+g), rows=o.rows.slice(col*rpc,(col+1)*rpc); rr(c,x,top,cw,bottom-top,14,"#fff","#bed0d6"); c.save();c.beginPath();c.rect(x,top,cw,bottom-top);c.clip();c.fillStyle="#174b59";c.fillRect(x,top,cw,hh);
    const nw=Math.round(cw*.09),sw=Math.round(cw*.22),namew=cw-nw-sw; tx(c,"م",x+cw-nw/2,top+hh/2,{size:15,weight:900,color:"#fff",align:"center"});tx(c,"اسم الطالب",x+sw+namew/2,top+hh/2,{size:16,weight:900,color:"#fff",align:"center"});tx(c,"الحالة",x+sw/2,top+hh/2,{size:15,weight:900,color:"#fff",align:"center"});ln(c,x+sw,top,x+sw,bottom);ln(c,x+sw+namew,top,x+sw+namew,bottom);
    rows.forEach((r,i)=>{const y=top+hh+i*rh;c.fillStyle=i%2?"#f7fafb":"#fff";c.fillRect(x,y,cw,rh);ln(c,x,y+rh,x+cw,y+rh);tx(c,r.number,x+cw-nw/2,y+rh/2,{size:15,weight:900,color:"#184654",align:"center"});studentName(c,r.name,x+cw-nw-12,y+rh/2,namew-24);const st=statusStyle(r.status),pw=Math.min(sw-22,112),ph=Math.min(30,rh-8),px=x+(sw-pw)/2,py=y+(rh-ph)/2;rr(c,px,py,pw,ph,ph/2,st.fill);tx(c,r.status,px+pw/2,y+rh/2,{size:Math.min(14,ph*.48),minSize:9,weight:900,color:st.color,align:"center",maxWidth:pw-12});});c.restore();
  }
  footer(c,o.portalName,`${o.className} — ${o.date}`,`تم إدراج ${o.rows.length} من ${o.rows.length} طالبًا`);return canvas;
}

export function renderGradesClassCanvas(o:GradesCanvasOptions){
  const {canvas,context:c}=canvasContext();header(c,"سجل رصد الدرجات",o.portalName,o.unitLabel);meta(c,[{label:"المعلم",value:o.teacherName||"—"},{label:"المادة",value:o.subject},{label:"المرحلة",value:o.stage},{label:"الفصل",value:o.className},{label:"عدد الطلاب",value:String(o.rows.length)}],142);
  const top=232,bottom=HEIGHT-64,m=28,g=16,count=o.rows.length<=16?1:2,rpc=Math.ceil(o.rows.length/count),cw=(WIDTH-m*2-g*(count-1))/count,hh=46,rh=Math.floor((bottom-top-hh)/Math.max(1,rpc));
  const ratios=[.055,.31,.09,.10,.09,.105,.09,.16],labels=["م","اسم الطالب","حضور","مشاركة","واجب","اختبار","المجموع","ملاحظات"];
  for(let col=0;col<count;col++){
    const x=WIDTH-m-cw-col*(cw+g),rows=o.rows.slice(col*rpc,(col+1)*rpc);rr(c,x,top,cw,bottom-top,14,"#fff","#bed0d6");c.save();c.beginPath();c.rect(x,top,cw,bottom-top);c.clip();c.fillStyle="#174b59";c.fillRect(x,top,cw,hh);
    const widths=ratios.map((r,i)=>i===ratios.length-1?0:Math.round(cw*r));widths[widths.length-1]=cw-widths.slice(0,-1).reduce((s,v)=>s+v,0);const edges=[x+cw];widths.forEach(w=>edges.push(edges[edges.length-1]-w));
    labels.forEach((lab,i)=>{const right=edges[i],left=edges[i+1];tx(c,i===5?(o.examLabel.replace(/^اختبار\s*/,"")||lab):lab,(right+left)/2,top+hh/2,{size:count===1?15:12.5,minSize:8,weight:900,color:"#fff",align:"center",maxWidth:Math.max(18,right-left-8)});if(i>0)ln(c,right,top,right,bottom);});
    rows.forEach((r,ri)=>{const y=top+hh+ri*rh;c.fillStyle=ri%2?"#f7fafb":"#fff";c.fillRect(x,y,cw,rh);ln(c,x,y+rh,x+cw,y+rh);const vals:Array<string|number>=[r.number,r.name,r.attendance,r.participation,r.homework,r.unitExam,r.total,r.notes||""];vals.forEach((v,i)=>{const right=edges[i],left=edges[i+1],cell=right-left;if(i===1){studentName(c,v,right-8,y+rh/2,cell-16);}else if(i===7){tx(c,v,right-8,y+rh/2,{size:Math.min(13,rh*.31),minSize:8,weight:700,color:"#526c77",maxWidth:cell-16});}else{tx(c,v,(right+left)/2,y+rh/2,{size:Math.min(15,rh*.34),minSize:8,weight:i===6?900:700,color:i===6?"#0f5c69":"#31515d",align:"center",maxWidth:cell-8});}});});c.restore();
  }
  footer(c,o.portalName,`${o.className} — ${o.unitLabel}`,`تم إدراج ${o.rows.length} من ${o.rows.length} طالبًا`);return canvas;
}
