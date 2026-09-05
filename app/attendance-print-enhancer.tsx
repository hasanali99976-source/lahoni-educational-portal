"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { downloadAttendancePdfDocument, type AttendancePdfCounts } from "../lib/attendance-pdf";

type AttendanceRow = { number: string; name: string; status: string };
function readText(selector:string){return document.querySelector<HTMLElement>(selector)?.innerText.trim()||"";}
function collectRows():AttendanceRow[]{return Array.from(document.querySelectorAll<HTMLElement>(".attendance-list article")).map((article,index)=>{const info=article.querySelector<HTMLElement>(".student-info");const active=article.querySelector<HTMLElement>(".status-buttons button.active");return{number:info?.querySelector<HTMLElement>("b")?.innerText.trim()||String(index+1),name:info?.querySelector<HTMLElement>("strong")?.innerText.trim()||"طالب",status:active?.innerText.trim()||"حاضر"};});}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]||char));}
function safeFile(value:string){return value.replace(/[\\/:*?"<>|]/g,"-").replace(/\s+/g,"-");}
function hijri(value:string){try{return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura",{day:"numeric",month:"long",year:"numeric"}).format(new Date(`${value}T12:00:00+03:00`));}catch{return value;}}

async function printAttendance(){
  const rows=collectRows();if(!rows.length)return window.alert("اختر الفصل أولًا حتى تظهر أسماء الطلاب.");
  const selectedClass=(document.querySelector<HTMLSelectElement>(".attendance-controls select")?.value||"الفصل").trim();
  const selectedDate=document.querySelector<HTMLInputElement>('.attendance-controls input[type="date"]')?.value||new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh"}).format(new Date());
  const teacher=readText(".attendance-head p")||"المعلم";
  const normalizedRows=rows.map((row,index)=>({number:index+1,name:row.name,status:row.status}));
  const counts:AttendancePdfCounts={present:rows.filter(row=>row.status==="حاضر").length,absent:rows.filter(row=>row.status==="غائب").length,late:rows.filter(row=>row.status==="متأخر").length,excused:rows.filter(row=>row.status==="مستأذن").length,escaped:rows.filter(row=>row.status==="هروب").length};
  try{await downloadAttendancePdfDocument({portalName:"بوابة أستاذ لحوني التعليمية",teacherName:teacher,subject:"المادة",date:selectedDate,hijriDate:hijri(selectedDate),classes:[{className:selectedClass,rows:normalizedRows,counts}],fileName:`سجل-المتابعة-${safeFile(selectedClass)}-${selectedDate}.pdf`});}catch{window.alert("تعذر إنشاء ملف PDF الآن.");}
}

function exportExcel(){
  const rows=collectRows();if(!rows.length)return window.alert("اختر الفصل أولًا حتى تظهر أسماء الطلاب.");
  const selectedClass=(document.querySelector<HTMLSelectElement>(".attendance-controls select")?.value||"الفصل").trim();
  const selectedDate=document.querySelector<HTMLInputElement>('.attendance-controls input[type="date"]')?.value||"";
  const title=readText(".attendance-head h1")||"كشف التحضير";
  const table=`<table dir="rtl"><tr><th colspan="5">بوابة أستاذ لحوني التعليمية</th></tr><tr><th colspan="5">${escapeHtml(title)} — ${escapeHtml(selectedClass)} — ${escapeHtml(selectedDate)}</th></tr><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>حالة الطالب</th><th>ملاحظات</th></tr>${rows.map(row=>`<tr><td>${escapeHtml(row.number)}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(selectedClass)}</td><td>${escapeHtml(row.status)}</td><td></td></tr>`).join("")}</table>`;
  const blob=new Blob(["\ufeff",table],{type:"application/vnd.ms-excel;charset=utf-8"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`${safeFile(title)}-${safeFile(selectedClass)}-${selectedDate||"اليوم"}.xls`;link.click();URL.revokeObjectURL(link.href);
}

export default function AttendancePrintEnhancer(){
  const pathname=usePathname();
  useEffect(()=>{
    if(pathname!=="/teacher/attendance")return;
    const controls=document.querySelector<HTMLElement>(".attendance-controls");if(!controls||controls.querySelector("[data-attendance-print]"))return;
    const printButton=document.createElement("button");printButton.type="button";printButton.dataset.attendancePrint="true";printButton.className="attendance-print-button";printButton.textContent="إنشاء PDF";printButton.addEventListener("click",()=>void printAttendance());
    const excelButton=document.createElement("button");excelButton.type="button";excelButton.dataset.attendanceExcel="true";excelButton.className="attendance-print-button attendance-excel-button";excelButton.textContent="تحميل Excel بالحالات";excelButton.addEventListener("click",exportExcel);
    controls.append(printButton,excelButton);return()=>{printButton.remove();excelButton.remove();};
  },[pathname]);
  return null;
}
