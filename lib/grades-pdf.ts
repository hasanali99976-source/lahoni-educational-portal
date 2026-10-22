"use client";

import { jsPDF } from "jspdf";
import {
  PRINT_ACCENTS, PRINT_HEIGHT, PRINT_WIDTH,
  createPrintCanvas, drawFittedText, drawFixedText, drawImageContain,
  ensurePrintFontsReady, loadPortalPrintLogo, printLine, roundedRect,
} from "./portal-print-system";

export type GradebookPdfColumn={id:string;label:string;max:number};
export type GradebookPdfRow={number:number;name:string;values:number[];sectionTotal:number;overallTotal:number;percentage:number};
export type GradebookPdfSection={id:string;label:string;max:number;columns:GradebookPdfColumn[];rows:GradebookPdfRow[]};
export type GradebookPdfClass={className:string;sections:GradebookPdfSection[];accentColor?:string};
export type GradebookPdfDocumentOptions={portalName:string;teacherName:string;subject:string;gradeLabel?:string;planLabel:string;planVersion:number;classes:GradebookPdfClass[];fileName:string;reportMode?:"summary"|"detailed"};

function round(value:number){return Math.round((Number.isFinite(value)?value:0)*100)/100;}
function sectionPercentage(row:GradebookPdfRow,section:GradebookPdfSection){return section.max>0?round((row.sectionTotal/section.max)*100):0;}
function metrics(rows:GradebookPdfRow[],section:GradebookPdfSection){const count=rows.length||1;const averageSection=round(rows.reduce((sum,row)=>sum+row.sectionTotal,0)/count);const averageSectionRate=round(rows.reduce((sum,row)=>sum+sectionPercentage(row,section),0)/count);const averageOverall=round(rows.reduce((sum,row)=>sum+row.percentage,0)/count);const excellent=rows.filter(row=>sectionPercentage(row,section)>=90).length;const support=rows.filter(row=>sectionPercentage(row,section)>0&&sectionPercentage(row,section)<60).length;return{averageSection,averageSectionRate,averageOverall,excellent,support};}

function header(ctx:CanvasRenderingContext2D,options:GradebookPdfDocumentOptions,report:GradebookPdfClass,section:GradebookPdfSection,accent:string,logo:HTMLImageElement|null,isFinalSection:boolean){
  roundedRect(ctx,34,20,PRINT_WIDTH-68,92,14,"#fff","#d9e6e3");
  ctx.fillStyle=accent;ctx.fillRect(34,20,PRINT_WIDTH-68,7);
  roundedRect(ctx,47,32,77,70,10,"#fff","#d6e3df");
  if(logo)drawImageContain(ctx,logo,52,35,67,64,2);
  drawFittedText(ctx,options.portalName,143,48,{size:17,weight:850,color:"#60777f",align:"left",maxWidth:570});
  drawFittedText(ctx,"تقرير الرصد والتحصيل الأكاديمي",143,76,{size:27,weight:900,color:"#153b49",align:"left",maxWidth:750});
  const unitTitle=section.label.replace(/ • صفحة \\d+$/,"");
  drawFittedText(ctx,unitTitle,143,98,{size:14,weight:800,color:accent,align:"left",maxWidth:740});
  roundedRect(ctx,PRINT_WIDTH-310,35,254,64,12,accent);
  drawFixedText(ctx,"التحصيل العلمي",PRINT_WIDTH-183,59,{size:21,weight:900,color:"#fff",align:"center",maxWidth:228});
  drawFixedText(ctx,report.className,PRINT_WIDTH-183,83,{size:16,weight:850,color:"#fff",align:"center",maxWidth:228});

  const meta=[["المعلم",options.teacherName],["المادة",options.subject],["المرحلة",options.gradeLabel||"—"],["الفصل",report.className]];
  const gap=10,margin=34,top=122,boxW=(PRINT_WIDTH-margin*2-gap*3)/4;
  meta.forEach(([label,value],i)=>{const x=PRINT_WIDTH-margin-boxW-i*(boxW+gap);roundedRect(ctx,x,top,boxW,48,9,"#f7faf9","#dce7e4");drawFixedText(ctx,label,x+boxW-12,top+15,{size:11,weight:800,color:"#7a9095",maxWidth:boxW-24});drawFittedText(ctx,value,x+boxW-12,top+35,{size:15,weight:850,color:"#21464c",align:"right",maxWidth:boxW-24});});
  const m=metrics(section.rows,section);
  const summary:Array<[string,string|number]>=[["متوسط الدرجة",`${m.averageSection} / ${section.max}`],["متوسط نسبة الوحدة",`${m.averageSectionRate}%`],["متميزون",m.excellent],["يحتاجون دعمًا",m.support]];
  const sw=(PRINT_WIDTH-68-gap*3)/4;
  summary.forEach(([label,value],i)=>{const x=PRINT_WIDTH-34-sw-i*(sw+gap);roundedRect(ctx,x,180,sw,43,9,i===1?"#e6f5ed":"#f7faf9","#dfe8e6");drawFixedText(ctx,value,x+sw/2,196,{size:18,weight:900,color:i===1?"#216c4c":"#244b51",align:"center",maxWidth:sw-18});drawFixedText(ctx,label,x+sw/2,214,{size:11,weight:800,color:"#6f858b",align:"center",maxWidth:sw-18});});
}

function table(ctx:CanvasRenderingContext2D,section:GradebookPdfSection,rows:GradebookPdfRow[],accent:string,isFinalSection:boolean){
  const x=34,top=235,w=PRINT_WIDTH-68,bottom=PRINT_HEIGHT-56,headerH=48;
  const available=bottom-top-headerH;const rowH=available/Math.max(rows.length,1);
  const dense=rows.length>=38;const compact=rows.length>=32;const nameSize=dense?17:compact?19:22;const cellSize=dense?14:compact?16:18;
  const columns=section.columns.map((column,originalIndex)=>({column,originalIndex}));
  let numW=50,nameW=450,totalW=110,sectionPctW=105,overallW=isFinalSection?118:0,percentW=isFinalSection?108:0;
  let fixed=numW+nameW+totalW+sectionPctW+overallW+percentW;
  let gradeW=(w-fixed)/Math.max(columns.length,1);
  if(gradeW<72){nameW=350;totalW=104;sectionPctW=96;overallW=isFinalSection?104:0;percentW=isFinalSection?94:0;fixed=numW+nameW+totalW+sectionPctW+overallW+percentW;gradeW=(w-fixed)/Math.max(columns.length,1);}
  roundedRect(ctx,x,top,w,bottom-top,14,"#fff","#cbdad6");ctx.save();ctx.beginPath();ctx.rect(x,top,w,bottom-top);ctx.clip();ctx.fillStyle=accent;ctx.fillRect(x,top,w,headerH);
  let cursor=x+w;const head=(width:number,label:string,sub="")=>{const c=cursor-width/2;const parts=label.includes("/")?label.split("/"):label.includes(" ")?label.split(" "):[label];const lines=parts.length>1&&label.length>12?[parts.slice(0,Math.ceil(parts.length/2)).join(" "),parts.slice(Math.ceil(parts.length/2)).join(" ")]:[label];lines.forEach((line,i)=>drawFittedText(ctx,line,c,top+(lines.length===2?12+i*16:20),{size:15.5,weight:900,color:"#fff",align:"center",maxWidth:width-10}));if(sub)drawFittedText(ctx,sub,c,top+43,{size:11.5,weight:800,color:"#e1f2ef",align:"center",maxWidth:width-8});cursor-=width;printLine(ctx,cursor,top,cursor,bottom,"rgba(255,255,255,.26)",1);};
  head(numW,"م");head(nameW,"اسم الطالب");columns.forEach(({column})=>head(gradeW,column.label,`من ${column.max}`));head(totalW,"مجموع الوحدة",`من ${section.max}`);head(sectionPctW,"نسبة الوحدة","%");if(isFinalSection){head(overallW,"المجموع الشامل","من 100");head(percentW,"النسبة الشاملة","%");}
  rows.forEach((row,index)=>{const y=top+headerH+index*rowH;ctx.fillStyle=index%2?"#f6faf9":"#fff";ctx.fillRect(x,y,w,rowH);printLine(ctx,x,y+rowH,x+w,y+rowH,"#e1e9e7");let r=x+w;
    const cell=(width:number,value:unknown,o:{name?:boolean;strong?:boolean;color?:string}={})=>{if(o.name)drawFittedText(ctx,String(value??""),r-13,y+rowH/2,{size:nameSize,weight:850,color:o.color,align:"right",maxWidth:width-26});else drawFixedText(ctx,value,r-width/2,y+rowH/2,{size:cellSize,weight:o.strong?900:800,color:o.color,align:"center",maxWidth:width-8});r-=width;printLine(ctx,r,y,r,y+rowH);};
    cell(numW,row.number,{strong:true});cell(nameW,row.name,{name:true});columns.forEach(({originalIndex})=>cell(gradeW,row.values[originalIndex]??0));cell(totalW,row.sectionTotal,{strong:true,color:accent});cell(sectionPctW,`${sectionPercentage(row,section)}%`,{strong:true,color:"#17614a"});if(isFinalSection){cell(overallW,row.overallTotal,{strong:true,color:"#226e4d"});cell(percentW,`${row.percentage}%`,{strong:true,color:"#17614a"});}
  });ctx.restore();
}

function footer(ctx:CanvasRenderingContext2D,options:GradebookPdfDocumentOptions,report:GradebookPdfClass,section:GradebookPdfSection,accent:string,isFinalSection:boolean){
  const y=PRINT_HEIGHT-28;printLine(ctx,34,y-20,PRINT_WIDTH-34,y-20,"#c8d7d3",1.4);drawFixedText(ctx,"توقيع المعلم: ______________",PRINT_WIDTH-34,y,{size:14,weight:800,color:"#60777f",align:"right",maxWidth:400});drawFixedText(ctx,"اعتماد مدير المدرسة: الأستاذ جاسم آل براك  |  التوقيع: ______________",PRINT_WIDTH/2+320,y,{size:13.5,weight:800,color:"#60777f",align:"right",maxWidth:660});drawFixedText(ctx,isFinalSection?"النتيجة الشاملة بعد اكتمال الوحدات / الفترات":"نسبة هذه الوحدة / الفترة مستقلة",PRINT_WIDTH/2,y,{size:14.5,weight:900,color:"#60777f",align:"center",maxWidth:420});drawFixedText(ctx,`${report.className} • ${section.label} • ${options.planLabel}`,34,y,{size:14.5,weight:900,color:accent,align:"left",maxWidth:560});
}

function render(options:GradebookPdfDocumentOptions,report:GradebookPdfClass,section:GradebookPdfSection,classIndex:number,logo:HTMLImageElement|null,isFinalSection:boolean){const {canvas,ctx}=createPrintCanvas();const accent=report.accentColor||PRINT_ACCENTS[classIndex%PRINT_ACCENTS.length]||PRINT_ACCENTS[0];header(ctx,options,report,section,accent,logo,isFinalSection);table(ctx,section,section.rows,accent,isFinalSection);footer(ctx,options,report,section,accent,isFinalSection);return canvas;}


export type GradebookSummaryRow={number:number;name:string;unitScores:number[];total:number;percentage:number};
function renderSummary(options:GradebookPdfDocumentOptions,report:GradebookPdfClass,classIndex:number,logo:HTMLImageElement|null){
  const {canvas,ctx}=createPrintCanvas();
  const accent=report.accentColor||PRINT_ACCENTS[classIndex%PRINT_ACCENTS.length]||PRINT_ACCENTS[0];
  const sections=report.sections;
  const max=sections.reduce((sum,section)=>sum+section.max,0);
  const rows:GradebookSummaryRow[]=(sections[0]?.rows||[]).map(row=>{
    const scores=sections.map(section=>section.rows.find(item=>item.number===row.number)?.sectionTotal??0);
    const total=round(scores.reduce((sum,score)=>sum+score,0));
    return{number:row.number,name:row.name,unitScores:scores,total,percentage:max>0?round(total/max*100):0};
  });
  const x=34,right=PRINT_WIDTH-34,full=PRINT_WIDTH-68;
  roundedRect(ctx,x,20,full,96,13,"#ffffff","#d7e3e8");
  ctx.fillStyle=accent;ctx.fillRect(x,20,full,7);
  roundedRect(ctx,right-90,34,76,72,10,"#fff","#d7e3e8");
  if(logo)drawImageContain(ctx,logo,right-85,39,66,62,2);
  drawFittedText(ctx,options.portalName,right-111,47,{size:17,weight:850,color:"#657e89",align:"right",maxWidth:640});
  drawFittedText(ctx,"كشف التحصيل الأكاديمي الموحد",right-111,77,{size:31,weight:900,color:"#143748",align:"right",maxWidth:930});
  drawFittedText(ctx,options.subject+"  |  "+report.className,right-111,103,{size:17,weight:850,color:accent,align:"right",maxWidth:850});
  roundedRect(ctx,x+15,38,360,59,10,"#eef5f9","#d7e3e8");
  drawFixedText(ctx,"نتائج الوحدات المختارة",x+195,59,{size:15,weight:800,color:"#617b88",align:"center",maxWidth:335});
  drawFixedText(ctx,String(sections.length)+" وحدات  •  الدرجة الكاملة "+max,x+195,83,{size:19,weight:900,color:accent,align:"center",maxWidth:335});
  const meta=[["المعلم",options.teacherName],["المادة",options.subject],["الفصل",report.className],["عدد الطلاب",String(rows.length)]];
  const gap=10,boxW=(full-gap*3)/4;
  meta.forEach(([label,value],i)=>{
    const bx=right-boxW-i*(boxW+gap);
    roundedRect(ctx,bx,126,boxW,52,9,"#f7fafb","#dce6e9");
    drawFixedText(ctx,label,bx+boxW-14,143,{size:12,weight:850,color:"#708792",align:"right",maxWidth:boxW-28});
    drawFittedText(ctx,value,bx+boxW-14,166,{size:18,weight:900,color:"#183e4d",align:"right",maxWidth:boxW-28});
  });
  const top=190,bottom=PRINT_HEIGHT-57,headerH=56;
  const numW=52,nameW=sections.length>5?380:510,totalW=140,pctW=130;
  const unitW=(full-numW-nameW-totalW-pctW)/Math.max(sections.length,1);
  roundedRect(ctx,x,top,full,bottom-top,10,"#fff","#d4e0e5");
  ctx.save();ctx.beginPath();ctx.rect(x,top,full,bottom-top);ctx.clip();
  ctx.fillStyle=accent;ctx.fillRect(x,top,full,headerH);
  let cursor=right;
  const heading=(width:number,label:string,sub="")=>{
    const center=cursor-width/2;
    drawFittedText(ctx,label,center,top+20,{size:17,weight:900,color:"#fff",align:"center",maxWidth:width-12});
    if(sub)drawFittedText(ctx,sub,center,top+43,{size:12,weight:800,color:"#f2f7fb",align:"center",maxWidth:width-12});
    cursor-=width;printLine(ctx,cursor,top,cursor,bottom,"#d7e1e7",1);
  };
  heading(numW,"م");heading(nameW,"اسم الطالب");
  sections.forEach((section,i)=>heading(unitW,"الوحدة "+(i+1),"من "+section.max));
  heading(totalW,"المجموع","من "+max);heading(pctW,"النسبة","%");
  const rowH=(bottom-top-headerH)/Math.max(rows.length,1);
  rows.forEach((row,index)=>{
    const y=top+headerH+index*rowH;
    ctx.fillStyle=index%2?"#f1f6f8":"#fff";ctx.fillRect(x,y,full,rowH);
    printLine(ctx,x,y+rowH,right,y+rowH,"#e1e9ed",1);
    let edge=right;
    const cell=(width:number,value:unknown,isName=false,emphasis=false)=>{
      if(isName)drawFittedText(ctx,String(value),edge-13,y+rowH/2,{size:rowH<25?17:20,weight:900,color:"#173b4c",align:"right",maxWidth:width-26});
      else drawFixedText(ctx,value,edge-width/2,y+rowH/2,{size:rowH<25?15:18,weight:emphasis?900:800,color:emphasis?accent:"#274755",align:"center",maxWidth:width-12});
      edge-=width;printLine(ctx,edge,y,edge,y+rowH,"#e1e9ed",1);
    };
    cell(numW,row.number);cell(nameW,row.name,true);
    row.unitScores.forEach(score=>cell(unitW,score));
    cell(totalW,row.total,false,true);cell(pctW,row.percentage+"%",false,true);
  });
  ctx.restore();
  const foot=PRINT_HEIGHT-30;
  printLine(ctx,x,foot-15,right,foot-15,"#cbdbe1",1);
  drawFixedText(ctx,"توقيع المعلم: ____________",right,foot,{size:14,weight:800,color:"#637d87",align:"right",maxWidth:350});
  drawFixedText(ctx,"اعتماد مدير المدرسة: الأستاذ جاسم آل براك  |  التوقيع: ____________",right-370,foot,{size:13.5,weight:850,color:"#637d87",align:"right",maxWidth:750});
  drawFixedText(ctx,"النسبة = مجموع الدرجات ÷ "+max+" × 100",x,foot,{size:14,weight:800,color:accent,align:"left",maxWidth:720});
  return canvas;
}

export async function downloadGradebookPdfDocument(options:GradebookPdfDocumentOptions){
  const classes=options.classes.filter(item=>item.sections.some(section=>section.rows.length));if(!classes.length)throw new Error("gradebook_pdf_no_students");
  await ensurePrintFontsReady();const logo=await loadPortalPrintLogo();
  if(options.reportMode!=="detailed"){
    const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});
    classes.forEach((report,index)=>{const canvas=renderSummary(options,report,index,logo);if(index)pdf.addPage("a4","landscape");pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,297,210,undefined,"FAST");});
    pdf.save(options.fileName);return{pageCount:classes.length,classCount:classes.length,studentCount:classes.reduce((sum,item)=>sum+(item.sections[0]?.rows.length||0),0)};
  }
  const pages:Array<{report:GradebookPdfClass;section:GradebookPdfSection;classIndex:number;isFinalSection:boolean}>=[];
  classes.forEach((report,classIndex)=>{const sections=report.sections.filter(section=>section.rows.length);sections.forEach((section,sectionIndex)=>{const rowsPerPage=40;for(let offset=0;offset<section.rows.length;offset+=rowsPerPage){const part=section.rows.slice(offset,offset+rowsPerPage);pages.push({report,section:{...section,rows:part,label:section.rows.length>rowsPerPage?`${section.label} • صفحة ${Math.floor(offset/rowsPerPage)+1}`:section.label},classIndex,isFinalSection:sections.length>1&&sectionIndex===sections.length-1});}});});
  const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});
  pages.forEach((item,index)=>{const canvas=render(options,item.report,item.section,item.classIndex,logo,item.isFinalSection);if(index)pdf.addPage("a4","landscape");pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,297,210,undefined,"FAST");});
  pdf.save(options.fileName);return{pageCount:pages.length,classCount:classes.length,studentCount:classes.reduce((sum,item)=>sum+Math.max(0,...item.sections.map(section=>section.rows.length)),0)};
}
