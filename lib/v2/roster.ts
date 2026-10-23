export type V2Student={id:string;name:string;grade:string;classId:string;active?:boolean;mobile?:string};
export type V2TeacherScope={teacherId:string;subjectKey:string;grade:string;classIds:string[]};
export function normalizeV2Students(rows:V2Student[]){const byId=new Map<string,V2Student>();for(const row of rows){const id=String(row.id||"").trim();if(!id)continue;byId.set(id,{...row,id,name:String(row.name||"").trim(),grade:String(row.grade||"").trim(),classId:String(row.classId||"").trim(),active:row.active!==false})}return [...byId.values()]}
export function studentsForTeacher(rows:V2Student[],scope:V2TeacherScope){const allowed=new Set(scope.classIds.map(String));return normalizeV2Students(rows).filter(s=>s.active!==false&&s.grade===scope.grade&&allowed.has(s.classId))}
export function moveStudent(rows:V2Student[],studentId:string,next:{grade:string;classId:string}){return normalizeV2Students(rows).map(s=>s.id===studentId?{...s,grade:next.grade,classId:next.classId}:s)}
