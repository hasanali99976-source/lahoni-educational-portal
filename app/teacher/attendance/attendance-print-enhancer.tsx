"use client";

import { useEffect } from "react";
import { useTeacherClient } from "../../../lib/teacher-client";
import { downloadAttendancePdfDocument, type AttendancePdfCounts } from "../../../lib/attendance-pdf";

const STATUS_KEYS = ["حاضر", "غائب", "متأخر", "مستأذن", "هروب"] as const;

function hijri(value:string){
  try{return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura",{day:"numeric",month:"long",year:"numeric"}).format(new Date(`${value}T12:00:00+03:00`));}
  catch{return value;}
}

export default function AttendancePrintEnhancer() {
  const session = useTeacherClient();

  useEffect(() => {
    const onClick = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(".attendance-pdf");
      if (!button || !button.closest(".attendance-page")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const className = document.querySelector<HTMLSelectElement>('[data-attendance-class-select="true"]')?.selectedOptions[0]?.textContent?.trim() || "—";
      const date = document.querySelector<HTMLInputElement>('[data-attendance-date-input="true"]')?.value || new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh"}).format(new Date());
      const cards = [...document.querySelectorAll<HTMLElement>(".attendance-student-card")];
      if (!cards.length) return window.alert("اختر فصلًا يحتوي على طلاب أولًا.");

      const rows = cards.map((card,index)=>({
        number:index+1,
        name:card.querySelector<HTMLElement>(".student-info strong")?.textContent?.trim()||"طالب دون اسم",
        status:card.querySelector<HTMLElement>(".student-info em")?.textContent?.trim()||"حاضر",
      }));
      const counts = Object.fromEntries(STATUS_KEYS.map(status=>[status,rows.filter(row=>row.status===status).length]));
      const normalized:AttendancePdfCounts={
        present:Number(counts["حاضر"]||0),
        absent:Number(counts["غائب"]||0),
        late:Number(counts["متأخر"]||0),
        excused:Number(counts["مستأذن"]||0),
        escaped:Number(counts["هروب"]||0),
      };

      button.disabled=true;
      try{
        await downloadAttendancePdfDocument({
          portalName:"بوابة أستاذ لحوني التعليمية",
          teacherName:session?.teacherName||"المعلم",
          subject:session?.subject||"المادة",
          date,
          hijriDate:hijri(date),
          classes:[{className,rows,counts:normalized}],
          fileName:`سجل-المتابعة-${className}-${date}.pdf`,
        });
      }catch{
        window.alert("تعذر إنشاء ملف PDF الآن.");
      }finally{
        button.disabled=false;
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [session?.teacherName, session?.subject]);

  return null;
}
