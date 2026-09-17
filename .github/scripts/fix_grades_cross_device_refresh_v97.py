from pathlib import Path

path = Path("app/teacher/grades/page.tsx")
text = path.read_text(encoding="utf-8")

old = '''  useEffect(()=>{
    if(!tenant)return;
    const controller=new AbortController();
    const params=new URLSearchParams({subjectId:tenant.subjectKey});
    if(session.activeGrade)params.set("grade",String(session.activeGrade));
    setLoading(true);setMessage("");
    Promise.all([
      fetch(`/api/teacher/students?${params.toString()}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل الطلاب");return data;}),
      fetch(`/api/teacher/grade-data?subjectId=${encodeURIComponent(tenant.subjectKey)}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل التحصيل المحفوظ");return data;}),
    ])
      .then(([data,academicData])=>{
        const byCode=academicData.byCode&&typeof academicData.byCode==="object"?academicData.byCode as Record<string,Record<string,unknown>>:{};
        const list:Student[]=(Array.isArray(data.students)?data.students:[]).map((value:Record<string,unknown>)=>{
          const code=String(value.code||value.id||"").trim().toUpperCase();
          const className=String(value.className||value.class||"").trim();
          const academic=byCode[code]||{};
          const gradeValues=academic.gradeValues&&typeof academic.gradeValues==="object"?academic.gradeValues as GradeValueMap:value.gradeValues&&typeof value.gradeValues==="object"?value.gradeValues as GradeValueMap:{};
          const gradePlanValues=academic.gradePlanValues&&typeof academic.gradePlanValues==="object"?academic.gradePlanValues as Record<string,GradeValueMap>:value.gradePlanValues&&typeof value.gradePlanValues==="object"?value.gradePlanValues as Record<string,GradeValueMap>:{};
          const gradeDeductions=Array.isArray(academic.gradeDeductions)?academic.gradeDeductions as GradeDeduction[]:Array.isArray(value.gradeDeductions)?value.gradeDeductions as GradeDeduction[]:[];
          return{...(value as unknown as Student),id:code,code,name:String(value.name||"").trim(),class:className,className,gradeValues,gradePlanValues,gradeDeductions};
        }).filter((student:Student)=>Boolean(student.id&&student.name&&student.class));
        list.sort((a,b)=>a.class.localeCompare(b.class,"ar",{numeric:true})||a.name.localeCompare(b.name,"ar"));
        setStudents(list);
      })
      .catch(error=>{if((error as Error)?.name!=="AbortError")setMessage(error instanceof Error?error.message:"تعذر تحميل طلاب المادة الحالية");})
      .finally(()=>setLoading(false));
    return()=>controller.abort();
  },[tenant,session.activeGrade]);
'''

new = '''  useEffect(()=>{
    if(!tenant)return;
    let controller:AbortController|null=null;
    let refreshing=false;
    let disposed=false;

    const refreshFromCloud=async()=>{
      if(disposed||refreshing||dirty||Object.values(deductionDirty).some(Boolean))return;
      refreshing=true;
      controller?.abort();
      controller=new AbortController();
      const params=new URLSearchParams({subjectId:tenant.subjectKey});
      if(session.activeGrade)params.set("grade",String(session.activeGrade));
      setLoading(true);setMessage("");
      try{
        const [data,academicData]=await Promise.all([
          fetch(`/api/teacher/students?${params.toString()}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل الطلاب");return data;}),
          fetch(`/api/teacher/grade-data?subjectId=${encodeURIComponent(tenant.subjectKey)}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||"تعذر تحميل التحصيل المحفوظ");return data;}),
        ]);
        if(disposed)return;
        const byCode=academicData.byCode&&typeof academicData.byCode==="object"?academicData.byCode as Record<string,Record<string,unknown>>:{};
        const list:Student[]=(Array.isArray(data.students)?data.students:[]).map((value:Record<string,unknown>)=>{
          const code=String(value.code||value.id||"").trim().toUpperCase();
          const className=String(value.className||value.class||"").trim();
          const academic=byCode[code]||{};
          const gradeValues=academic.gradeValues&&typeof academic.gradeValues==="object"?academic.gradeValues as GradeValueMap:value.gradeValues&&typeof value.gradeValues==="object"?value.gradeValues as GradeValueMap:{};
          const gradePlanValues=academic.gradePlanValues&&typeof academic.gradePlanValues==="object"?academic.gradePlanValues as Record<string,GradeValueMap>:value.gradePlanValues&&typeof value.gradePlanValues==="object"?value.gradePlanValues as Record<string,GradeValueMap>:{};
          const gradeDeductions=Array.isArray(academic.gradeDeductions)?academic.gradeDeductions as GradeDeduction[]:Array.isArray(value.gradeDeductions)?value.gradeDeductions as GradeDeduction[]:[];
          return{...(value as unknown as Student),id:code,code,name:String(value.name||"").trim(),class:className,className,gradeValues,gradePlanValues,gradeDeductions};
        }).filter((student:Student)=>Boolean(student.id&&student.name&&student.class));
        list.sort((a,b)=>a.class.localeCompare(b.class,"ar",{numeric:true})||a.name.localeCompare(b.name,"ar"));
        setStudents(list);
      }catch(error){if((error as Error)?.name!=="AbortError"&&!disposed)setMessage(error instanceof Error?error.message:"تعذر تحميل طلاب المادة الحالية");}
      finally{refreshing=false;if(!disposed)setLoading(false);}
    };

    const refreshWhenActive=()=>{if(document.visibilityState==="visible")void refreshFromCloud();};
    void refreshFromCloud();
    window.addEventListener("focus",refreshWhenActive);
    document.addEventListener("visibilitychange",refreshWhenActive);
    return()=>{disposed=true;controller?.abort();window.removeEventListener("focus",refreshWhenActive);document.removeEventListener("visibilitychange",refreshWhenActive);};
  },[tenant,session.activeGrade,dirty,deductionDirty]);
'''

if old not in text:
    raise RuntimeError("grades source no longer matches guarded load block")
path.write_text(text.replace(old,new,1),encoding="utf-8")
print("Grades now refresh from the central no-store APIs on load/focus without polling or live Firestore listeners, while preserving unsaved edits.")
