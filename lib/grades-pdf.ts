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
export type GradebookPdfDocumentOptions={portalName:string;teacherName:string;subject:string;gradeLabel?:string;planLabel:string;planVersion:number;classes:GradebookPdfClass[];fileName:string};

function round(value:number){return Math.round((Number.isFinite(value)?value:0)*100)/100;}
function sectionPercentage(row:GradebookPdfRow,section:GradebookPdfSection){return section.max>0?round((row.sectionTotal/section.max)*100):0;}
function metrics(rows:GradebookPdfRow[],section:GradebookPdfSection){const count=rows.length||1;const averageSection=round(rows.reduce((sum,row)=>sum+row.sectionTotal,0)/count);const averageSectionRate=round(rows.reduce((sum,row)=>sum+sectionPercentage(row,section),0)/count);const averageOverall=round(rows.reduce((sum,row)=>sum+row.percentage,0)/count);const excellent=rows.filter(row=>sectionPercentage(row,section)>=90).length;const support=rows.filter(row=>sectionPercentage(row,section)>0&&sectionPercentage(row,section)<60).length;return{averageSection,averageSectionRate,averageOverall,excellent,support};}

function header(ctx:CanvasRenderingContext2D,options:GradebookPdfDocumentOptions,report:GradebookPdfClass,section:GradebookPdfSection,accent:string,logo:HTMLImageElement|null,isFinalSection:boolean){
  roundedRect(ctx,34,24,PRINT_WIDTH-68,128,22,"#fff","#d9e6e3");ctx.fillStyle=accent;ctx.fillRect(34,24,PRINT_WIDTH-68,13);
  roundedRect(ctx,48,42,116,96,17,"#fff","#d6e3df");if(logo)drawImageContain(ctx,logo,54,48,104,84,2);
  drawFittedText(ctx,options.portalName,182,59,{size:23,weight:900,color:"#60777f",align:"left",maxWidth:540});
  drawFittedText(ctx,"تقرير الرصد والتحصيل الأكاديمي",182,98,{size:34,weight:900,color:"#153b49",align:"left",maxWidth:800});
  drawFittedText(ctx,isFinalSection?`${section.label} • النتيجة الشاملة`:section.label,182,132,{size:18,weight:850,color:accent,align:"left",maxWidth:700});
  roundedRect(ctx,PRINT_WIDTH-398,44,332,88,18,accent);drawFixedText(ctx,"التحصيل العلمي",PRINT_WIDTH-92,73,{size:28,weight:900,color:"#fff",maxWidth:278});drawFixedText(ctx,report.className,PRINT_WIDTH-92,109,{size:20,weight:900,color:"#e4f5f2",maxWidth:278});

  const meta=[["المعلم",options.teacherName],["المادة",options.subject],["المرحلة",options.gradeLabel||"—"],["الفصل",report.className],["الوحدة / الفترة",section.label]];const gap=10,margin=34,top=166,boxW=(PRINT_WIDTH-margin*2-gap*4)/5;
  meta.forEach(([label,value],i)=>{const x=PRINT_WIDTH-margin-boxW-i*(boxW+gap);roundedRect(ctx,x,top,boxW,70,13,"#f7faf9","#dce7e4");drawFixedText(ctx,label,x+boxW-14,top+21,{size:14,weight:850,color:"#7a9095",maxWidth:boxW-28});drawFittedText(ctx,value,x+boxW-14,top+49,{size:19,weight:900,color:"#21464c",maxWidth:boxW-28});});
  const m=metrics(section.rows,section);const summary:Array<[string,string|number]>=[["متوسط الدرجة",`${m.averageSection} / ${section.max}`],["متوسط نسبة الوحدة",`${m.averageSectionRate}%`],[isFinalSection?"النسبة الشاملة":"نسبة هذه الوحدة",isFinalSection?`${m.averageOverall}%`:`${m.averageSectionRate}%`],["متميزون",m.excellent],["يحتاجون دعمًا",m.support],["الخطة",`نسخة ${options.planVersion}`]];const sw=(PRINT_WIDTH-68-gap*5)/6;
  summary.forEach(([label,value],i)=>{const x=PRINT_WIDTH-34-sw-i*(sw+gap);const highlight=i===1||i===2;roundedRect(ctx,x,250,sw,64,13,highlight?"#e6f5ed":"#f7faf9","#dfe8e6");drawFixedText(ctx,value,x+sw/2,272,{size:22.5,weight:900,color:highlight?"#216c4c":"#244b51",align:"center",maxWidth:sw-20});drawFixedText(ctx,label,x+sw/2,299,{size:13,weight:850,color:"#6f858b",align:"center",maxWidth:sw-16});});
}

function table(ctx:CanvasRenderingContext2D,section:GradebookPdfSection,rows:GradebookPdfRow[],accent:string,isFinalSection:boolean){
  const x=34,top=330,w=PRINT_WIDTH-68,bottom=PRINT_HEIGHT-88,headerH=58;
  const available=bottom-top-headerH;const rowH=Math.max(12.5,available/Math.max(rows.length,1));
  const dense=rows.length>=38;const compact=rows.length>=32;const nameSize=dense?16:compact?18:21;const cellSize=dense?13.5:compact?15.5:17.5;
  const columns=section.columns.map((column,originalIndex)=>({column,originalIndex}));
  let numW=58,nameW=310,totalW=118,sectionPctW=110,overallW=isFinalSection?118:0,percentW=isFinalSection?108:0;
  let fixed=numW+nameW+totalW+sectionPctW+overallW+percentW;
  let gradeW=(w-fixed)/Math.max(columns.length,1);
  if(gradeW<72){nameW=260;totalW=104;sectionPctW=96;overallW=isFinalSection?104:0;percentW=isFinalSection?94:0;fixed=numW+nameW+totalW+sectionPctW+overallW+percentW;gradeW=(w-fixed)/Math.max(columns.length,1);}
  roundedRect(ctx,x,top,w,bottom-top,14,"#fff","#cbdad6");ctx.save();ctx.beginPath();ctx.rect(x,top,w,bottom-top);ctx.clip();ctx.fillStyle=accent;ctx.fillRect(x,top,w,headerH);
  let cursor=x+w;const head=(width:number,label:string,sub="")=>{const c=cursor-width/2;drawFittedText(ctx,label,c,top+20,{size:15.5,weight:900,color:"#fff",align:"center",maxWidth:width-8});if(sub)drawFittedText(ctx,sub,c,top+43,{size:11.5,weight:800,color:"#e1f2ef",align:"center",maxWidth:width-8});cursor-=width;printLine(ctx,cursor,top,cursor,bottom,"rgba(255,255,255,.26)",1);};
  head(numW,"م");head(nameW,"اسم الطالب");columns.forEach(({column})=>head(gradeW,column.label,`من ${column.max}`));head(totalW,"مجموع الوحدة",`من ${section.max}`);head(sectionPctW,"نسبة الوحدة","%");if(isFinalSection){head(overallW,"المجموع الشامل","من 100");head(percentW,"النسبة الشاملة","%");}
  rows.forEach((row,index)=>{const y=top+headerH+index*rowH;ctx.fillStyle=index%2?"#f6faf9":"#fff";ctx.fillRect(x,y,w,rowH);printLine(ctx,x,y+rowH,x+w,y+rowH,"#e1e9e7");let r=x+w;
    const cell=(width:number,value:unknown,o:{name?:boolean;strong?:boolean;color?:string}={})=>{if(o.name)drawFixedText(ctx,value,r-13,y+rowH/2,{size:nameSize,weight:850,color:o.color,maxWidth:width-26});else drawFixedText(ctx,value,r-width/2,y+rowH/2,{size:cellSize,weight:o.strong?900:800,color:o.color,align:"center",maxWidth:width-8});r-=width;printLine(ctx,r,y,r,y+rowH);};
    cell(numW,row.number,{strong:true});cell(nameW,row.name,{name:true});columns.forEach(({originalIndex})=>cell(gradeW,row.values[originalIndex]??0));cell(totalW,row.sectionTotal,{strong:true,color:accent});cell(sectionPctW,`${sectionPercentage(row,section)}%`,{strong:true,color:"#17614a"});if(isFinalSection){cell(overallW,row.overallTotal,{strong:true,color:"#226e4d"});cell(percentW,`${row.percentage}%`,{strong:true,color:"#17614a"});}
  });ctx.restore();
}

function footer(ctx:CanvasRenderingContext2D,options:GradebookPdfDocumentOptions,report:GradebookPdfClass,section:GradebookPdfSection,accent:string,isFinalSection:boolean){
  const y=PRINT_HEIGHT-48;printLine(ctx,34,y-20,PRINT_WIDTH-34,y-20,"#c8d7d3",1.4);drawFixedText(ctx,"اعتماد المعلم: __________________________",PRINT_WIDTH-34,y,{size:14.5,weight:800,color:"#60777f",maxWidth:470});drawFixedText(ctx,isFinalSection?"النتيجة الشاملة بعد اكتمال الوحدات / الفترات":"نسبة هذه الوحدة / الفترة مستقلة",PRINT_WIDTH/2,y,{size:14.5,weight:900,color:"#60777f",align:"center",maxWidth:420});drawFixedText(ctx,`${report.className} • ${section.label} • ${options.planLabel}`,34,y,{size:14.5,weight:900,color:accent,align:"left",maxWidth:560});
}

function render(options:GradebookPdfDocumentOptions,report:GradebookPdfClass,section:GradebookPdfSection,classIndex:number,logo:HTMLImageElement|null,isFinalSection:boolean){const {canvas,ctx}=createPrintCanvas();const accent=report.accentColor||PRINT_ACCENTS[classIndex%PRINT_ACCENTS.length]||PRINT_ACCENTS[0];header(ctx,options,report,section,accent,logo,isFinalSection);table(ctx,section,section.rows,accent,isFinalSection);footer(ctx,options,report,section,accent,isFinalSection);return canvas;}

export async function downloadGradebookPdfDocument(options:GradebookPdfDocumentOptions){
  const classes=options.classes.filter(item=>item.sections.some(section=>section.rows.length));if(!classes.length)throw new Error("gradebook_pdf_no_students");
  await ensurePrintFontsReady();const logo=await loadPortalPrintLogo();
  const pages:Array<{report:GradebookPdfClass;section:GradebookPdfSection;classIndex:number;isFinalSection:boolean}>=[];
  classes.forEach((report,classIndex)=>{const sections=report.sections.filter(section=>section.rows.length);sections.forEach((section,sectionIndex)=>pages.push({report,section,classIndex,isFinalSection:sectionIndex===sections.length-1}));});
  const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});
  pages.forEach((item,index)=>{const canvas=render(options,item.report,item.section,item.classIndex,logo,item.isFinalSection);if(index)pdf.addPage("a4","landscape");pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,297,210,undefined,"FAST");});
  pdf.save(options.fileName);return{pageCount:pages.length,classCount:classes.length,studentCount:classes.reduce((sum,item)=>sum+Math.max(0,...item.sections.map(section=>section.rows.length)),0)};
}
