from pathlib import Path

student = Path('app/student/page.tsx')
s = student.read_text()
s = s.replace('import Link from "next/link";\n', '')
s = s.replace('<Link href="/"><img src={LOGO} alt="بوابة أستاذ لحوني التعليمية"/><span><small>بوابة أستاذ لحوني التعليمية</small><strong>بوابة الطالب وولي الأمر</strong></span></Link><Link href="/" className="scl-back">الرئيسية العامة</Link>', '<div className="scl-brand-lock"><img src={LOGO} alt="بوابة أستاذ لحوني التعليمية"/><span><small>بوابة أستاذ لحوني التعليمية</small><strong>بوابة الطالب وولي الأمر</strong></span></div>')
s = s.replace('<Link href="/" className="scg-brand"><img src={LOGO} alt="هوية البوابة"/><span><small>بوابة أستاذ لحوني التعليمية</small><strong>اختر مسارك الدراسي</strong></span></Link>', '<div className="scg-brand scg-brand-lock"><img src={LOGO} alt="هوية البوابة"/><span><small>بوابة أستاذ لحوني التعليمية</small><strong>اختر مسارك الدراسي</strong></span></div>')
s = s.replace('<Link href="/">العودة للبوابة الرئيسية</Link>', '')
s = s.replace('<Link href="/" className="sc-brand"><img src={LOGO} alt="هوية البوابة"/><span><small>أستاذ لحوني</small><b>بوابة الطالب</b></span></Link>', '<div className="sc-brand sc-brand-lock"><img src={LOGO} alt="هوية البوابة"/><span><small>أستاذ لحوني</small><b>بوابة الطالب</b></span></div>')
if 'href="/"' in s or '<Link' in s:
    raise SystemExit('student still contains root navigation or Link usage')
student.write_text(s)

teacher = Path('app/teacher/page.tsx')
t = teacher.read_text()
t = t.replace('import Link from "next/link";\n', '')
t = t.replace('<section className="teacher-entry-intro">', '<section className="teacher-entry-intro unified-entry-intro">')
t = t.replace('<section className="v3-login-card"><Link href="/" className="v3-back">← العودة إلى البوابة الرئيسية</Link>', '<section className="v3-login-card unified-entry-card">')
if 'href="/"' in t or '<Link' in t:
    raise SystemExit('teacher still contains legacy root Link')
teacher.write_text(t)

css = Path('app/portal-entry-unified.css')
css.write_text(r'''
/* Login identity aligned with approved main portal: navy/teal/paper, same spacing and surfaces. */
.v3-teacher-login,.student-current-login{background:#f3f7fa!important;color:#143645!important;min-height:100dvh!important}
.v3-teacher-login{padding:16px!important;display:grid!important;grid-template-columns:minmax(0,1fr) minmax(380px,520px)!important;gap:0!important;max-width:1500px!important;margin:auto!important}
.v3-teacher-login .unified-entry-intro{border-radius:30px 0 0 30px!important;background:linear-gradient(120deg,#062f45,#084b63)!important;padding:48px clamp(30px,5vw,70px)!important;color:#fff!important;display:flex!important;flex-direction:column!important;justify-content:center!important}
.v3-teacher-login .unified-entry-intro span{color:#bce8e5!important}.v3-teacher-login .unified-entry-intro h1{color:#fff!important;font-size:clamp(38px,4.4vw,64px)!important;line-height:1.12!important}.v3-teacher-login .unified-entry-intro p{color:#d5e8ed!important;line-height:1.85!important}
.v3-teacher-login .unified-entry-card{margin:0!important;border-radius:0 30px 30px 0!important;border:1px solid #dbe6ec!important;box-shadow:0 22px 54px rgba(6,47,69,.12)!important;background:#fff!important;align-self:stretch!important;display:flex!important;flex-direction:column!important;justify-content:center!important;padding:clamp(28px,4vw,52px)!important}
.v3-teacher-login .v3-primary{background:#0aa39b!important}.v3-teacher-login input{border-color:#dbe6ec!important;background:#f4f8fa!important}
.student-current-login .scl-frame{border-color:#dbe6ec!important;box-shadow:0 22px 54px rgba(6,47,69,.12)!important}.student-current-login .scl-intro{background:linear-gradient(120deg,#062f45,#084b63)!important}.student-current-login .scl-card button[type=submit]{background:#0aa39b!important}.student-current-login .scl-brand-lock,.scg-brand-lock,.sc-brand-lock{display:flex;align-items:center;gap:11px;color:inherit}.student-current-login .scl-brand-lock img{width:52px;height:52px;object-fit:contain;border-radius:14px;background:#fff}
@media(max-width:760px){.v3-teacher-login{grid-template-columns:1fr!important;padding:9px!important}.v3-teacher-login .unified-entry-intro{border-radius:24px 24px 0 0!important;padding:30px 22px!important}.v3-teacher-login .unified-entry-card{border-radius:0 0 24px 24px!important;padding:26px 20px!important}}
''')

layout = Path('app/layout.tsx')
l = layout.read_text()
needle = 'import "./home-identity-unified.css";'
if 'portal-entry-unified.css' not in l:
    l = l.replace(needle, needle + '\nimport "./portal-entry-unified.css";')
layout.write_text(l)
