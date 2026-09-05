"use client";

import { useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { tenantCollection } from "../../../lib/teacher-tenant";
import { useTeacherClient } from "../../../lib/teacher-client";
import { downloadDiagnosticsPdfDocument, type DiagnosticPdfClass } from "../../../lib/diagnostics-pdf";

type Student = { id:string; name?:string; class?:string; className?:string; code?:string; accessCode?:string; studentCode?:string };
type Result = { id:string; diagnosticId?:string; studentId?:string; score?:number; total?:number; percentage?:number; weakSkills?:string[]; plan?:string; aiPlan?:string; teacherPlan?:string; submittedAt?:string };

const LETTER_CLASS:Record<string,string>={"أ":"1","ا":"1","ب":"2","ج":"3","د":"4","هـ":"5","ه":"5","و":"6","ز":"7","ح":"8","ط":"9","ي":"10","a":"1","b":"2","c":"3","d":"4","e":"5","f":"6","g":"7","h":"8","i":"9","j":"10"};
function aliases(student:Student){return[...new Set([student.id,student.code,student.accessCode,student.studentCode].map(value=>String(value||"").trim()).filter(Boolean))];}
function classKey(value:unknown){const raw=String(value||"").trim().replace(/[إآ]/g,"أ");if(!raw)return"";const western=raw.replace(/[٠-٩]/g,digit=>String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));const trailingNumber=western.match(/(\d+)\s*$/)?.[1];if(trailingNumber)return String(Number(trailingNumber));const trailingLetter=raw.match(/([أابجدهـوزحطيA-Ja-j])\s*$/)?.[1];if(trailingLetter)return LETTER_CLASS[trailingLetter.toLowerCase()]||LETTER_CLASS[trailingLetter]||raw;return raw;}
function arabicDigits(value:string){return value.replace(/[0-9]/g,digit=>"٠١٢٣٤٥٦٧٨٩"[Number(digit)]);}
function classDisplay(value:string){return/^\d+$/.test(value)?`الفصل ${arabicDigits(value)}`:value||"فصل غير محدد";}
function percentOf(result?:Result){if(!result)return 0;const percentage=Number(result.percentage);if(Number.isFinite(percentage))return Math.max(0,Math.min(100,Math.round(percentage)));return Number(result.total)?Math.round(Number(result.score||0)/Number(result.total)*100):0;}
function levelOf(result?:Result){if(!result)return"لم يعمل";const percentage=percentOf(result);if(percentage>=80)return"متقن";if(percentage>=50)return"يحتاج تحسين";return"خطة علاجية";}
function shortText(value:string,max=110){const clean=value.replace(/\s+/g," ").trim();return clean.length>max?`${clean.slice(0,max-1)}…`:clean||"—";}
function safe(value:string){return value.replace(/[\\/:*?"<>|]/g,"-");}

export default function DiagnosticsPrintEnhancer(){
  const session=useTeacherClient();
  useEffect(()=>{
    const onClick=async(event:MouseEvent)=>{
      const button=(event.target as HTMLElement|null)?.closest<HTMLButtonElement>(".diag-head-actions button");
      const label=button?.textContent?.replace(/\s+/g," ").trim()||"";
      if(!button||!label.includes("تقرير"))return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      if(!session?.teacherId||!session.subjectKey)return window.alert("انتهت جلسة المعلم. أعد تسجيل الدخول.");
      const selectors=document.querySelectorAll<HTMLSelectElement>(".diag-primary-selectors select");
      const selectedClass=selectors[0]?.value||"all";
      const selectedTest=selectors[1]?.value||"";
      const diagnosticTitle=selectors[1]?.selectedOptions[0]?.textContent?.trim()||"الاختبار التشخيصي";
      if(!selectedTest)return window.alert("اختر الاختبار أولًا.");

      button.disabled=true;const originalLabel=button.textContent;button.textContent="جارٍ تجهيز التقرير…";
      try{
        const params=new URLSearchParams({subjectId:session.subjectKey});if(session.activeGrade)params.set("grade",String(session.activeGrade));
        const rosterResponse=await fetch(`/api/teacher/students?${params.toString()}`,{cache:"no-store"});
        const rosterData=await rosterResponse.json().catch(()=>({}));if(!rosterResponse.ok)throw new Error(rosterData.message||"تعذر تحميل الطلاب.");
        const students=(Array.isArray(rosterData.students)?rosterData.students:[]) as Student[];if(!students.length)throw new Error("لا توجد أسماء طلاب في الفصول المحددة.");

        const resultSnapshot=await getDocs(collection(db,tenantCollection(session.teacherId,session.subjectKey as never,"diagnosticResults")));
        const cloudResults=resultSnapshot.docs.map(item=>({id:item.id,...(item.data() as Omit<Result,"id">)}));
        const studentIds=[...new Set(students.flatMap(aliases))];let backupResults:Result[]=[];
        try{const backupResponse=await fetch("/api/teacher/diagnostics/backup-results",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subjectId:session.subjectKey,diagnosticId:selectedTest,studentIds}),cache:"no-store"});const backupData=await backupResponse.json().catch(()=>({}));if(backupResponse.ok&&Array.isArray(backupData.results))backupResults=backupData.results;}catch{backupResults=[];}

        const studentByAlias=new Map<string,Student>();students.forEach(student=>aliases(student).forEach(alias=>studentByAlias.set(alias,student)));
        const latestByStudent=new Map<string,Result>();
        [...backupResults,...cloudResults].filter(result=>result.diagnosticId===selectedTest).forEach(result=>{const student=studentByAlias.get(String(result.studentId||"").trim());if(!student)return;const current=latestByStudent.get(student.id);if(!current||String(result.submittedAt||"")>=String(current.submittedAt||""))latestByStudent.set(student.id,result);});

        const grouped=new Map<string,Student[]>();students.forEach(student=>{const key=classKey(student.className||student.class);if(selectedClass!=="all"&&key!==selectedClass)return;const rows=grouped.get(key)||[];rows.push(student);grouped.set(key,rows);});
        const groups=[...grouped.entries()].filter(([,rows])=>rows.length).sort((a,b)=>Number(a[0])-Number(b[0])||a[0].localeCompare(b[0],"ar",{numeric:true}));if(!groups.length)throw new Error("لا توجد أسماء في الفصل المحدد.");

        const classes:DiagnosticPdfClass[]=groups.map(([key,roster])=>{
          roster.sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar"));
          const rows=roster.map((student,index)=>{const result=latestByStudent.get(student.id);const percentage=result?percentOf(result):null;const plan=result?(result.teacherPlan||result.aiPlan||result.plan||(Number(percentage)<50?"شرح المهارة، تدريب موجه، ثم إعادة قياس قصيرة.":Number(percentage)<80?"مراجعة مركزة وتدريبات متدرجة ثم قياس متابعة.":"نشاط إثرائي وتطبيق متقدم للمحافظة على الإتقان.")):"متابعة الطالب وتشجيعه على أداء الاختبار.";return{number:index+1,name:String(student.name||student.id),completed:Boolean(result),scoreText:result?`${Number(result.score||0)}/${Number(result.total||0)}`:"—",percentage,level:levelOf(result),weakSkills:shortText(result?.weakSkills?.join("، ")||"—",70),plan:shortText(plan,120)};});
          const completed=rows.filter(row=>row.completed&&row.percentage!==null);const average=completed.length?Math.round(completed.reduce((sum,row)=>sum+Number(row.percentage||0),0)/completed.length):0;const mastered=completed.filter(row=>Number(row.percentage)>=80).length;const support=completed.filter(row=>Number(row.percentage)<50).length;const skillCounts=new Map<string,number>();roster.forEach(student=>latestByStudent.get(student.id)?.weakSkills?.forEach(skill=>skillCounts.set(skill,(skillCounts.get(skill)||0)+1)));const topSkill=[...skillCounts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||"لا توجد مهارة ضعيفة مشتركة";
          return{className:classDisplay(key),testTitle:diagnosticTitle,rows,average,mastered,support,topSkill};
        });

        await downloadDiagnosticsPdfDocument({portalName:"بوابة أستاذ لحوني التعليمية",teacherName:session.teacherName||"المعلم",subject:session.subject||"المادة",gradeLabel:session.activeGradeLabel||"",classes,fileName:`تقرير-تشخيصي-${safe(diagnosticTitle)}.pdf`});
      }catch(error){window.alert(error instanceof Error?error.message:"تعذر تجهيز التقرير.");}
      finally{button.disabled=false;button.textContent=originalLabel||"تقرير PDF";}
    };
    document.addEventListener("click",onClick,true);return()=>document.removeEventListener("click",onClick,true);
  },[session?.teacherId,session?.subjectKey,session?.activeGrade,session?.activeGradeLabel,session?.teacherName,session?.subject]);
  return null;
}
