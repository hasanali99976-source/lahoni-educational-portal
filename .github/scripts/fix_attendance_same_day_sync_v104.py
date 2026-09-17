from pathlib import Path
p=Path('app/api/student/profile/route.ts')
s=p.read_text()
old='''  const counts = { present: 0, absent: 0, late: 0, excused: 0, escaped: 0, total: 0 };
  let latestDate = "";
  const automaticPresent = 0;
  explicitByDate.forEach((entry, date) => { counts[entry.status] += 1; counts.total += 1; if (date > latestDate) latestDate = date; });
  const today = riyadhDateInput(new Date());
  const disciplineRate = counts.total ? Math.max(0, Math.round(((counts.present + counts.excused + counts.late * 0.5) / counts.total) * 100)) : 100;'''
new='''  const counts = { present: 0, absent: 0, late: 0, excused: 0, escaped: 0, total: 0 };
  let latestDate = "";
  const automaticPresent = 0;
  explicitByDate.forEach((entry, date) => { counts[entry.status] += 1; counts.total += 1; if (date > latestDate) latestDate = date; });
  const today = riyadhDateInput(new Date());
  // The teacher attendance page shows one selected day's roster counts. Expose the same
  // cloud-saved day explicitly so web/mobile/app never compare a cumulative total to a daily total.
  const latestEntry = latestDate ? explicitByDate.get(latestDate) : undefined;
  const latestDayCounts = { present: 0, absent: 0, late: 0, excused: 0, escaped: 0, total: latestEntry ? 1 : 0 };
  if (latestEntry) latestDayCounts[latestEntry.status] = 1;
  const disciplineRate = counts.total ? Math.max(0, Math.round(((counts.present + counts.excused + counts.late * 0.5) / counts.total) * 100)) : 100;'''
if old not in s: raise SystemExit('guard profile count block changed')
s=s.replace(old,new)
old='''attendanceSummary: { ...counts, automaticPresent, disciplineRate, latestDate, automaticThrough: today, attendanceMode: "teacher_saved_only", attendanceSource }'''
new='''attendanceSummary: { ...counts, automaticPresent, disciplineRate, latestDate, latestDayCounts, automaticThrough: today, attendanceMode: "teacher_saved_only", attendanceSource }'''
if old not in s: raise SystemExit('guard attendance summary changed')
s=s.replace(old,new)
p.write_text(s)

p=Path('app/student/page.tsx')
s=p.read_text()
old='''type AttendanceSummary={present?:number;absent?:number;late?:number;excused?:number;escaped?:number;total?:number;disciplineRate?:number;latestDate?:string};'''
new='''type AttendanceDayCounts={present?:number;absent?:number;late?:number;excused?:number;escaped?:number;total?:number};
type AttendanceSummary={present?:number;absent?:number;late?:number;excused?:number;escaped?:number;total?:number;disciplineRate?:number;latestDate?:string;latestDayCounts?:AttendanceDayCounts};'''
if old not in s: raise SystemExit('guard attendance type changed')
s=s.replace(old,new)
# Keep historical cumulative data intact; student surfaces that describe the latest attendance use latestDayCounts.
old='''const attendance=data.attendanceSummary;if(Number(attendance?.absent||0)>0||Number(attendance?.late||0)>0||Number(attendance?.escaped||0)>0)rows.push({id:`attendance-${match.subjectKey}`,kind:"alert",subject,title:"تنبيه الحضور والانضباط",text:`الغياب ${ar(Number(attendance?.absent||0))} • التأخر ${ar(Number(attendance?.late||0))} • الهروب ${ar(Number(attendance?.escaped||0))}`,meta:"متابعة الانضباط",createdAt:attendance?.latestDate||"",tone:"red"});'''
new='''const attendance=data.attendanceSummary;const attendanceDay=attendance?.latestDayCounts||attendance;if(Number(attendanceDay?.absent||0)>0||Number(attendanceDay?.late||0)>0||Number(attendanceDay?.escaped||0)>0)rows.push({id:`attendance-${match.subjectKey}`,kind:"alert",subject,title:"آخر سجل حضور وانضباط",text:`الغياب ${ar(Number(attendanceDay?.absent||0))} • التأخر ${ar(Number(attendanceDay?.late||0))} • الهروب ${ar(Number(attendanceDay?.escaped||0))}`,meta:attendance?.latestDate?`سجل ${attendance.latestDate}`:"متابعة الانضباط",createdAt:attendance?.latestDate||"",tone:"red"});'''
if old not in s: raise SystemExit('guard attendance feed changed')
s=s.replace(old,new)
p.write_text(s)
print('same-day attendance synchronization prepared')