from pathlib import Path


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Could not remove {label}")
    return text.replace(old, new)

follow_path = Path("app/teacher/follow-up/page.tsx")
follow = follow_path.read_text(encoding="utf-8")
follow = replace_required(
    follow,
    "type Student = { id: string; name?: string; class?: string; nationalId?: string; researchScore?: number; teacherNote?: string; units?: Record<string, UnitRecord> };",
    "type Student = { id: string; name?: string; class?: string; researchScore?: number; teacherNote?: string; units?: Record<string, UnitRecord> };",
    "national ID from follow-up",
)
follow_path.write_text(follow, encoding="utf-8")

ai_path = Path("app/teacher/ai/page.tsx")
ai = ai_path.read_text(encoding="utf-8")
ai = replace_required(
    ai,
    "type Student = { id: string; name?: string; nationalId?: string; class?: string; research?: number; researchScore?: number; units?: Record<string, UnitRecord> };",
    "type Student = { id: string; name?: string; class?: string; research?: number; researchScore?: number; units?: Record<string, UnitRecord> };",
    "national ID from AI",
)
ai_path.write_text(ai, encoding="utf-8")

reports_path = Path("app/teacher/reports/page.tsx")
reports = reports_path.read_text(encoding="utf-8")
reports = replace_required(
    reports,
    "type Student={id:string;name?:string;class?:string;nationalId?:string;researchScore?:number;units?:Record<string,UnitRecord>};",
    "type Student={id:string;name?:string;class?:string;researchScore?:number;units?:Record<string,UnitRecord>};",
    "national ID type from reports",
)
reports = replace_required(
    reports,
    '<p>{student.class||"غير محدد"} • السجل المدني: {student.nationalId||"—"}</p>',
    '<p>الفصل: {student.class||"غير محدد"}</p>',
    "national ID summary from reports",
)
reports = replace_required(
    reports,
    '<span><b>السجل المدني:</b> {student.nationalId||"—"}</span>',
    "",
    "national ID print field from reports",
)
reports_path.write_text(reports, encoding="utf-8")
