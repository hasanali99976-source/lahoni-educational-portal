from pathlib import Path

p=Path('app/teacher/attendance/page.tsx')
s=p.read_text()
old='[hasSavedRecord,setHasSavedRecord]=useState(false),[allPdfBusy,setAllPdfBusy]=useState(false);'
new='[hasSavedRecord,setHasSavedRecord]=useState(false),[attendanceDirty,setAttendanceDirty]=useState(false),[allPdfBusy,setAllPdfBusy]=useState(false);'
assert old in s, 'state block changed'
s=s.replace(old,new,1)
old='const refresh=async()=>{if(!active||loading||saving||deleting)return;'
new='const refresh=async()=>{if(!active||loading||saving||deleting||attendanceDirty)return;'
assert old in s, 'refresh guard changed'
s=s.replace(old,new,1)
old='},[selectedClass,selectedDate,classStudents,attendancePath,teacherId,subjectKey,saving,deleting]);'
new='},[selectedClass,selectedDate,classStudents,attendancePath,teacherId,subjectKey,saving,deleting,attendanceDirty]);'
assert old in s, 'attendance effect deps changed'
s=s.replace(old,new,1)
old='function setStudentStatus(st:UnifiedStudent,status:AttendanceStatus){const next={...records,[studentCode(st)]:status};setRecords(next);persistLocal(next);setMessage('
new='function setStudentStatus(st:UnifiedStudent,status:AttendanceStatus){const next={...records,[studentCode(st)]:status};setRecords(next);setAttendanceDirty(true);persistLocal(next);setMessage('
assert old in s, 'status setter changed'
s=s.replace(old,new,1)
old='setMessage("تم حفظ التحضير ومزامنته مع جميع الأجهزة") }catch'
new='setAttendanceDirty(false);setMessage("تم حفظ التحضير ومزامنته مع جميع الأجهزة") }catch'
assert old in s, 'save success changed'
s=s.replace(old,new,1)
old='setHasSavedRecord(false);setMessage("تم حذف التحضير")'
new='setHasSavedRecord(false);setAttendanceDirty(false);setMessage("تم حذف التحضير")'
assert old in s, 'delete success changed'
s=s.replace(old,new,1)
p.write_text(s)
print('attendance record safe-sync guard applied')
