from pathlib import Path

ROOT = Path('.')

helper = r'''
function speakLoginGreeting(role: "teacher" | "student", person?: string) {
  if (typeof window === "undefined") return;
  const clean = String(person || "").trim().replace(/^(الأستاذ|استاذ|أستاذ|المعلم|الطالب|أ\.)\s*/u, "").trim();
  const text = role === "teacher"
    ? (clean ? `مرحبًا أستاذ ${clean}. أهلًا بك في بوابة أستاذ لحوني التعليمية.` : "مرحبًا أستاذ. أهلًا بك في بوابة أستاذ لحوني التعليمية.")
    : (clean ? `مرحبًا ${clean}. كيف حالك اليوم؟ نتمنى لك يومًا دراسيًا موفقًا.` : "مرحبًا بك. نتمنى لك يومًا دراسيًا موفقًا ومميزًا.");

  try {
    const native = (window as any).OstadhApp;
    if (native && typeof native.speakArabic === "function") {
      native.speakArabic(text);
      return;
    }
    const nativeTts = (window as any).OstadhTts;
    if (nativeTts && typeof nativeTts.speakArabic === "function") {
      nativeTts.speakArabic(text);
      return;
    }
  } catch {}

  try {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    utterance.rate = 0.94;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => /^ar-SA$/i.test(v.lang)) || voices.find(v => /^ar(?:-|$)/i.test(v.lang));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  } catch {}
}
'''

# Teacher login: inject direct user-gesture speech.
teacher_path = ROOT / 'app/teacher/page.tsx'
teacher = teacher_path.read_text(encoding='utf-8')
if 'function speakLoginGreeting(role:' not in teacher:
    marker = 'import "./teacher-login-v14.css";\n'
    if marker not in teacher:
        raise SystemExit('teacher import marker not found')
    teacher = teacher.replace(marker, marker + '\n' + helper + '\n', 1)

old = 'event.preventDefault(); setError(""); setLoading(true);'
new = 'event.preventDefault(); speakLoginGreeting("teacher", name); setError(""); setLoading(true);'
if new not in teacher:
    if old not in teacher:
        raise SystemExit('teacher submit marker not found')
    teacher = teacher.replace(old, new, 1)
teacher_path.write_text(teacher, encoding='utf-8')

# Student portal: inject same direct speech into every lookup/login attempt.
student_path = ROOT / 'app/student/page.tsx'
student = student_path.read_text(encoding='utf-8')
if 'function speakLoginGreeting(role:' not in student:
    marker = 'const ar = (value: number) => new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0);\n'
    if marker not in student:
        raise SystemExit('student helper marker not found')
    student = student.replace(marker, marker + '\n' + helper + '\n', 1)

old = '  async function lookup(codeValue: string) {\n    const code = normalizeStudentCode(codeValue);'
new = '  async function lookup(codeValue: string) {\n    speakLoginGreeting("student");\n    const code = normalizeStudentCode(codeValue);'
if new not in student:
    if old not in student:
        raise SystemExit('student lookup marker not found')
    student = student.replace(old, new, 1)
student_path.write_text(student, encoding='utf-8')

print('Direct login voice wired into teacher and student login flows.')
