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
  const y=PRINT_HEIGHT-28;printLine(ctx,34,y-20,PRINT_WIDTH-34,y-20,"#c8d7d3",1.4);drawFixedText(ctx,"اعتماد المعلم: __________________________",PRINT_WIDTH-34,y,{size:14.5,weight:800,color:"#60777f",maxWidth:470});drawFixedText(ctx,isFinalSection?"النتيجة الشاملة بعد اكتمال الوحدات / الفترات":"نسبة هذه الوحدة / الفترة مستقلة",PRINT_WIDTH/2,y,{size:14.5,weight:900,color:"#60777f",align:"center",maxWidth:420});drawFixedText(ctx,`${report.className} • ${section.label} • ${options.planLabel}`,34,y,{size:14.5,weight:900,color:accent,align:"left",maxWidth:560});
}

function render(options:GradebookPdfDocumentOptions,report:GradebookPdfClass,section:GradebookPdfSection,classIndex:number,logo:HTMLImageElement|null,isFinalSection:boolean){const {canvas,ctx}=createPrintCanvas();const accent=report.accentColor||PRINT_ACCENTS[classIndex%PRINT_ACCENTS.length]||PRINT_ACCENTS[0];header(ctx,options,report,section,accent,logo,isFinalSection);table(ctx,section,section.rows,accent,isFinalSection);footer(ctx,options,report,section,accent,isFinalSection);return canvas;}


export type GradebookSummaryRow={number:number;name:string;unitScores:number[];total:number;percentage:number};
function renderSummary(options:GradebookPdfDocumentOptions,report:GradebookPdfClass,classIndex:number,logo:HTMLImageElement|null){
  const {canvas,ctx}=createPrintCanvas();const accent=report.accentColor||PRINT_ACCENTS[classIndex%PRINT_ACCENTS.length]||PRINT_ACCENTS[0];
  const sections=report.sections;const first=sections[0];const count=first?.rows.length||0;const max=sections.reduce((sum,s)=>sum+s.max,0);
  const rows:GradebookSummaryRow[]=(first?.rows||[]).map((row,i)=>{const scores=sections.map(section=>section.rows.find(r=>r.number===row.number)?.sectionTotal||0);const total=round(scores.reduce((a,b)=>a+b,0));return{number:row.number,name:row.name,unitScores:scores,total,percentage:max?round(total/max*100):0};});
  roundedRect(ctx,34,22,PRINT_WIDTH-68,100,16,"#fff","#d8e4e1");ctx.fillStyle=accent;ctx.fillRect(34,22,PRINT_WIDTH-68,8);
  roundedRect(ctx,48,36,82,76,10,"#fff","#d6e3df");if(logo)drawImageContain(ctx,logo,53,41,72,66,2);
  drawFittedText(ctx,options.portalName,148,52,{size:18,weight:850,color:"#647c81",align:"left",maxWidth:690});
  drawFittedText(ctx,"كشف التحصيل الأكاديمي الموحد",148,85,{size:31,weight:900,color:"#153b49",align:"left",maxWidth:850});
  drawFittedText(ctx,options.subject+" • "+report.className,148,109,{size:18,weight:850,color:accent,align:"left",maxWidth:760});
  const meta=[["المعلم",options.teacherName],["المادة",options.subject],["الفصل",report.className],["الوحدات",String(sections.length)],["الدرجة الكاملة",String(max)]];
  const gap=10,w=(PRINT_WIDTH-68-gap*4)/5;meta.forEach(([label,value],i)=>{const x=PRINT_WIDTH-34-w-i*(w+gap);roundedRect(ctx,x,135,w,55,10,"#f5faf9","#dce7e4");drawFixedText(ctx,label,x+w-12,153,{size:12,weight:800,color:"#70858a",maxWidth:w-24});drawFittedText(ctx,value,x+w-12,177,{size:18,weight:900,color:"#21464c",align:"right",maxWidth:w-24});});
  const top=205,bottom=PRINT_HEIGHT-65,headH=54,tableW=PRINT_WIDTH-68,x=34;
  const numW=55,nameW=sections.length>5?360:470,pctW=125,totalW=135,unitW=(tableW-numW-nameW-pctW-totalW)/sections.length;
  roundedRect(ctx,x,top,tableW,bottom-top,12,"#fff","#d8e4e1");ctx.save();ctx.beginPath();ctx.rect(x,top,tableW,bottom-top);ctx.clip();ctx.fillStyle=accent;ctx.fillRect(x,top,tableW,headH);
  let cursor=x+tableW;const head=(width:number,label:string,sub:string="")=>{const center=cursor-width/2;drawFittedText(ctx,label,center,top+19,{size:17,weight:900,color:"#fff",align:"center",maxWidth:width-12});if(sub)drawFittedText(ctx,sub,center,top+41,{size:12,weight:800,color:"#fff",align:"center",maxWidth:width-12});cursor-=width;};
  head(numW,"م");head(nameW,"اسم الطالب");sections.forEach((sec,i)=>head(unitW,sec.label.split(/[-–]/)[0].trim()||"الوحدة "+(i+1),"من "+sec.max));head(totalW,"المجموع","من "+max);head(pctW,"النسبة","%");
  const rowH=(bottom-top-headH)/Math.max(rows.length,1);
  rows.forEach((row,i)=>{const y=top+headH+i*rowH;ctx.fillStyle=i%2?"#f4f8f7":"#fff";ctx.fillRect(x,y,tableW,rowH);printLine(ctx,x,y+rowH,x+tableW,y+rowH,"#e2e9e7");let right=x+tableW;const cell=(width:number,value:unknown,name=false,strong=false)=>{if(name)drawFittedText(ctx,String(value),right-12,y+rowH/2,{size:rowH<24?17:20,weight:850,color:"#163d4b",align:"right",maxWidth:width-24});else drawFixedText(ctx,value,right-width/2,y+rowH/2,{size:rowH<24?15:18,weight:strong?900:800,color:strong?accent:"#21464c",align:"center",maxWidth:width-12});right-=width;printLine(ctx,right,y,right,y+rowH);};cell(numW,row.number);cell(nameW,row.name,true);row.unitScores.forEach(score=>cell(unitW,score));cell(totalW,row.total,false,true);cell(pctW,row.percentage+"%",false,true);});ctx.restore();
  const foot=PRINT_HEIGHT-33;printLine(ctx,34,foot-14,PRINT_WIDTH-34,foot-14,"#c8d7d3");drawFixedText(ctx,"اعتماد المعلم: __________________",PRINT_WIDTH-34,foot,{size:14,weight:800,color:"#60777f",maxWidth:420});drawFixedText(ctx,"النسبة = مجموع درجات الوحدات المختارة ÷ "+max+" × 100",34,foot,{size:14,weight:800,color:accent,align:"left",maxWidth:850});
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
