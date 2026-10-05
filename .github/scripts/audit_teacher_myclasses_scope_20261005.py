from pathlib import Path

ROOT = Path('app/teacher')
TERMS = ('notes', 'grades', 'master', 'proficiency', 'achievement', 'attainment')

print('AUDIT ONLY: teacher class scope')
for p in ROOT.rglob('*.tsx'):
    low = str(p).lower()
    if any(t in low for t in TERMS):
        txt = p.read_text(encoding='utf-8', errors='ignore')
        hits = [x for x in ('selectedClasses','myClasses','teacherClasses','classIds','classes') if x in txt]
        print(p, hits)
