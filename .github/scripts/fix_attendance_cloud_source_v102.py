from pathlib import Path
p=Path('app/teacher/attendance/page.tsx')
s=p.read_text()
old_import='import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";\n'
old_db='import { db } from "../../../lib/firebase";\n'
if old_import not in s or old_db not in s: raise SystemExit('guard: firestore imports changed')
s=s.replace(old_import,'').replace(old_db,'')
old='''const s=await withTimeout(getDoc(doc(db,attendancePath,documentId)),5000);if(!active)return;if(!s.exists()){if(local&&!deleted)useLocalFallback();return}const data=s.data() as AttendanceDocument,saved=data.records||{},next=Object.fromEntries(classStudents.map(st=>[studentCode(st),saved[studentCode(st)]||"present"])) as Record<string,AttendanceStatus>;'''
new='''const params=new URLSearchParams({subjectId:subjectKey,className:selectedClass,date:selectedDate});const response=await fetch(`/api/teacher/attendance/record?${params}`,{credentials:"same-origin",cache:"no-store"});if(!response.ok)throw new Error("attendance_cloud_load_failed");const payload=await response.json();if(!active)return;if(!payload.exists){if(local&&!deleted)useLocalFallback();return}const data=(payload.data||{}) as AttendanceDocument,saved=data.records||{},next=Object.fromEntries(classStudents.map(st=>[studentCode(st),saved[studentCode(st)]||"present"])) as Record<string,AttendanceStatus>;'''
if old not in s: raise SystemExit('guard: attendance load block changed')
s=s.replace(old,new)
old='''await withTimeout(setDoc(doc(db,attendancePath,`${safeId(selectedClass)}_${selectedDate}`),{class:selectedClass,date:selectedDate,hijriDate:formatHijri(selectedDate),records,teacherId,teacherName,subjectKey,subject,manualEdited:true,updatedAt:new Date().toISOString()},{merge:true}),5000);setAttendanceDirty(false);setMessage("تم حفظ التحضير ومزامنته مع جميع الأجهزة")'''
new='''const response=await fetch("/api/teacher/attendance/record",{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({subjectId:subjectKey,className:selectedClass,date:selectedDate,hijriDate:formatHijri(selectedDate),records,subject})});if(!response.ok)throw new Error("attendance_cloud_save_failed");setAttendanceDirty(false);setMessage("تم حفظ الحضور سحابيًا ومزامنته مع الويب والجوال والتطبيق")'''
if old not in s: raise SystemExit('guard: attendance save block changed')
s=s.replace(old,new)
old='''await deleteDoc(doc(db,attendancePath,`${safeId(selectedClass)}_${selectedDate}`));'''
new='''const params=new URLSearchParams({subjectId:subjectKey,className:selectedClass,date:selectedDate});const response=await fetch(`/api/teacher/attendance/record?${params}`,{method:"DELETE",credentials:"same-origin",cache:"no-store"});if(!response.ok)throw new Error("attendance_cloud_delete_failed");'''
if old not in s: raise SystemExit('guard: attendance delete block changed')
s=s.replace(old,new)
s=s.replace('اضغط حفظ التحضير لمزامنتها بين جميع الأجهزة.','اضغط حفظ الحضور لمزامنتها بين جميع الأجهزة.')
p.write_text(s)
print('attendance teacher page now uses server-backed cloud record API')
