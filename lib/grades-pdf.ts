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

export type GradebookPdfColumn={id:string;label:string;max:number};
export type GradebookPdfRow={number:number;name:string;values:number[];sectionTotal:number;overallTotal:number;percentage:number};
export type GradebookPdfSection={id:string;label:string;max:number;columns:GradebookPdfColumn[];rows:GradebookPdfRow[]};
export type GradebookPdfClass={className:string;sections:GradebookPdfSection[];accentColor?:string};
export type GradebookPdfDocumentOptions={portalName:string;teacherName:string;subject:string;gradeLabel?:string;planLabel:string;planVersion:number;classes:GradebookPdfClass[];fileName:string};

const MAX_COLUMNS=6,MAX_ROWS_PER_PAGE=36;
function chunks<T>(items:T[],size:number){if(!items.length)return[[]] as T[][];return Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size));}
function metrics(rows:GradebookPdfRow[],section:GradebookPdfSection){const count=rows.length||1;const averageSection=Math.round((rows.reduce((sum,row)=>sum+row.sectionTotal,0)/count)*10)/10;const averageOverall=Math.round((rows.reduce((sum,row)=>sum+row.percentage,0)/count)*10)/10;const excellent=rows.filter(row=>row.percentage>=90).length;const support=rows.filter(row=>row.percentage>0&&row.percentage<60).length;const sectionRate=section.max?Math.round((averageSection/section.max)*100):0;return{averageSection,averageOverall,excellent,support,sectionRate};}
function header(ctx:CanvasRenderingContext2D,options:GradebookPdfDocumentOptions,report:GradebookPdfClass,section:GradebookPdfSection,accent:string,classIndex:number,colIndex:number,colCount:number,logo:HTMLImageElement|null,rowIndex:number,rowCount:number){
  roundedRect(ctx,34,30,PRINT_WIDTH-68,126,24,"#fff","#dce8e4");roundedRect(ctx,PRINT_WIDTH-360,30,326,126,24,accent);
  drawFittedText(ctx,"بوابة تعليمية ذكية",PRINT_WIDTH-332,62,{size:15,min:12,weight:900,color:"#dcefeb",maxWidth:270});drawFittedText(ctx,"التحصيل العلمي",PRINT_WIDTH-332,101,{size:29,min:21,weight:900,color:"#fff",maxWidth:275});
  roundedRect(ctx,46,38,114,108,22,"#fff","#d6e3df");if(logo)drawImageContain(ctx,logo,50,42,106,100,4);
  drawFittedText(ctx,options.portalName,178,64,{size:20,min:15,weight:900,color:"#647d81",align:"left",maxWidth:500});drawFittedText(ctx,"تقرير الرصد والتحصيل الأكاديمي",178,108,{size:31,min:23,weight:900,color:"#173d45",align:"left",maxWidth:690});
  const parts=[`الفصل ${classIndex+1} من ${options.classes.length}`];if(colCount>1)parts.push(`أعمدة ${colIndex+1}/${colCount}`);if(rowCount>1)parts.push(`طلاب ${rowIndex+1}/${rowCount}`);roundedRect(ctx,178,132,350,24,12,"#f3f7f6");drawFittedText(ctx,parts.join(" • "),353,144,{size:11,min:9.5,weight:900,color:accent,align:"center",maxWidth:330});
  const meta=[["المعلم",options.teacherName],["المادة",options.subject],["المرحلة",options.gradeLabel||"—"],["الفصل",report.className],["الوحدة / الفترة",section.label]];const gap=10,margin=34,top=172,boxW=(PRINT_WIDTH-margin*2-gap*4)/5;
  meta.forEach(([label,value],i)=>{const x=PRINT_WIDTH-margin-boxW-i*(boxW+gap);roundedRect(ctx,x,top,boxW,66,13,"#f8fbfa","#dce7e4");drawFixedText(ctx,label,x+boxW-14,top+20,{size:11,weight:900,color:"#859598",maxWidth:boxW-28});drawFittedText(ctx,value,x+boxW-14,top+45,{size:16,min:10.5,weight:900,color:"#21464c",maxWidth:boxW-28});});
  const m=metrics(section.rows,section);const summary=[["متوسط الوحدة",`${m.averageSection} / ${section.max}`],["نسبة الوحدة",`${m.sectionRate}%`],["متوسط التحصيل",`${m.averageOverall}%`],["متميزون",m.excellent],["يحتاجون دعمًا",m.support],["الخطة",`نسخة ${options.planVersion}`]] as const;const sw=(PRINT_WIDTH-68-gap*5)/6;
  summary.forEach(([label,value],i)=>{const x=PRINT_WIDTH-34-sw-i*(sw+gap);const highlight=i===2||i===3;roundedRect(ctx,x,252,sw,62,13,highlight?"#eaf6f1":"#f7faf9","#dfe8e6");drawFixedText(ctx,value,x+sw/2,272,{size:18,weight:900,color:highlight?"#216c4c":"#244b51",align:"center",maxWidth:sw-20});drawFixedText(ctx,label,x+sw/2,296,{size:10.5,weight:900,color:"#758b8e",align:"center"});});
}
function table(ctx:CanvasRenderingContext2D,section:GradebookPdfSection,rows:GradebookPdfRow[],columns:Array<{column:GradebookPdfColumn;originalIndex:number}>,accent:string){
  const x=34,top=332,w=PRINT_WIDTH-68,bottom=PRINT_HEIGHT-100,headerH=58;const rowH=Math.floor((bottom-top-headerH)/Math.max(rows.length,18));
  const numW=60,nameW=350,totalW=130,overallW=125,percentW=105;const fixed=numW+nameW+totalW+overallW+percentW;const gradeW=(w-fixed)/Math.max(columns.length,1);roundedRect(ctx,x,top,w,bottom-top,14,"#fff","#cbdad6");ctx.save();ctx.beginPath();ctx.rect(x,top,w,bottom-top);ctx.clip();ctx.fillStyle=accent;ctx.fillRect(x,top,w,headerH);
  let cursor=x+w;const head=(width:number,label:string,sub="")=>{const c=cursor-width/2;drawFittedText(ctx,label,c,top+21,{size:13,min:9.5,weight:900,color:"#fff",align:"center",maxWidth:width-10});if(sub)drawFittedText(ctx,sub,c,top+42,{size:9.5,min:8,weight:800,color:"#dcefeb",align:"center",maxWidth:width-10});cursor-=width;printLine(ctx,cursor,top,cursor,bottom,"rgba(255,255,255,.25)",1);};
  head(numW,"م");head(nameW,"اسم الطالب");columns.forEach(({column})=>head(gradeW,column.label,`من ${column.max}`));head(totalW,"مجموع الوحدة",`من ${section.max}`);head(overallW,"المجموع الحالي","من 100");head(percentW,"التحصيل","%");
  rows.forEach((row,index)=>{const y=top+headerH+index*rowH;ctx.fillStyle=index%2?"#f8fbfa":"#fff";ctx.fillRect(x,y,w,rowH);printLine(ctx,x,y+rowH,x+w,y+rowH,"#e4ecea");let r=x+w;const cell=(width:number,value:unknown,o:{name?:boolean;strong?:boolean;color?:string}={})=>{if(o.name)drawFixedText(ctx,value,r-13,y+rowH/2,{size:STUDENT_NAME_FONT_SIZE,weight:800,color:o.color,maxWidth:width-26});else drawFixedText(ctx,value,r-width/2,y+rowH/2,{size:11,weight:o.strong?900:800,color:o.color,align:"center",maxWidth:width-9});r-=width;printLine(ctx,r,y,r,y+rowH);};
    cell(numW,row.number,{strong:true});cell(nameW,row.name,{name:true});columns.forEach(({originalIndex})=>cell(gradeW,row.values[originalIndex]??0));cell(totalW,row.sectionTotal,{strong:true,color:accent});cell(overallW,row.overallTotal,{strong:true,color:"#226e4d"});cell(percentW,`${row.percentage}%`,{strong:true});
  });ctx.restore();
}
function footer(ctx:CanvasRenderingContext2D,options:GradebookPdfDocumentOptions,report:GradebookPdfClass,section:GradebookPdfSection,accent:string,rowIndex:number,rowCount:number){const y=PRINT_HEIGHT-64;printLine(ctx,34,y-20,PRINT_WIDTH-34,y-20,"#c8d7d3",1.3);drawFixedText(ctx,"اعتماد المعلم: __________________________",PRINT_WIDTH-34,y,{size:12,weight:800,color:"#647b80",maxWidth:450});drawFixedText(ctx,`صفحة الطلاب ${rowIndex+1} من ${rowCount}`,PRINT_WIDTH/2,y,{size:11.5,weight:900,color:"#647b80",align:"center",maxWidth:260});drawFixedText(ctx,`${report.className} • ${section.label} • ${options.planLabel}`,34,y,{size:11.5,weight:900,color:accent,align:"left",maxWidth:520});}
function render(options:GradebookPdfDocumentOptions,report:GradebookPdfClass,section:GradebookPdfSection,rows:GradebookPdfRow[],classIndex:number,columns:Array<{column:GradebookPdfColumn;originalIndex:number}>,colIndex:number,colCount:number,logo:HTMLImageElement|null,rowIndex:number,rowCount:number){const {canvas,ctx}=createPrintCanvas();const accent=report.accentColor||PRINT_ACCENTS[classIndex%PRINT_ACCENTS.length]||PRINT_ACCENTS[0];header(ctx,options,report,section,accent,classIndex,colIndex,colCount,logo,rowIndex,rowCount);table(ctx,section,rows,columns,accent);footer(ctx,options,report,section,accent,rowIndex,rowCount);return canvas;}

export async function downloadGradebookPdfDocument(options:GradebookPdfDocumentOptions){
  const classes=options.classes.filter(item=>item.sections.some(section=>section.rows.length));if(!classes.length)throw new Error("gradebook_pdf_no_students");
  await ensurePrintFontsReady();const logo=await loadPortalPrintLogo();
  const pages:Array<{report:GradebookPdfClass;section:GradebookPdfSection;rows:GradebookPdfRow[];classIndex:number;columns:Array<{column:GradebookPdfColumn;originalIndex:number}>;colIndex:number;colCount:number;rowIndex:number;rowCount:number}>=[];
  classes.forEach((report,classIndex)=>report.sections.filter(section=>section.rows.length).forEach(section=>{const indexed=section.columns.map((column,originalIndex)=>({column,originalIndex}));const columnGroups=chunks(indexed,MAX_COLUMNS);const rowGroups=chunks(section.rows,MAX_ROWS_PER_PAGE);columnGroups.forEach((columns,colIndex)=>rowGroups.forEach((rows,rowIndex)=>pages.push({report,section,rows,classIndex,columns,colIndex,colCount:columnGroups.length,rowIndex,rowCount:rowGroups.length})));}));
  const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});pages.forEach((item,index)=>{const canvas=render(options,item.report,item.section,item.rows,item.classIndex,item.columns,item.colIndex,item.colCount,logo,item.rowIndex,item.rowCount);if(index)pdf.addPage("a4","landscape");pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,297,210,undefined,"FAST");});
  pdf.save(options.fileName);return{pageCount:pages.length,classCount:classes.length,studentCount:classes.reduce((sum,item)=>sum+Math.max(0,...item.sections.map(section=>section.rows.length)),0)};
}
