from pathlib import Path

path = Path("app/teacher/portfolio/page.tsx")
source = path.read_text(encoding="utf-8")

source = source.replace(
    'import { doc, onSnapshot, setDoc } from "firebase/firestore";',
    'import { doc, getDoc, setDoc } from "firebase/firestore";',
)

old = '''    const ref = doc(db, tenantCollection(teacherId, subjectKey as any, "portfolio"), "profile");
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const cloudForm = normalizeForm(snap.data() as Partial<PortfolioForm>);
          const next: PortfolioForm = {
            ...cloudForm,
            evidence: mergeCloudWithDeviceFiles(cloudForm.evidence, localForm?.evidence || []),
          };
          setForm(next);
          saveLocal(localKey, next);
          localForm = next;
        } else if (localForm) {
          setForm(localForm);
        }
        setLoaded(true);
      },
      () => {
        if (localForm) setForm(localForm);
        else setMessage("تعذر الاتصال مؤقتًا. سيعود ملف الإنجاز للمزامنة تلقائيًا عند توفر الشبكة.");
        setLoaded(true);
      },
    );

    return unsubscribe;
'''
new = '''    const ref = doc(db, tenantCollection(teacherId, subjectKey as any, "portfolio"), "profile");
    let cancelled = false;
    void getDoc(ref)
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          const cloudForm = normalizeForm(snap.data() as Partial<PortfolioForm>);
          const next: PortfolioForm = {
            ...cloudForm,
            evidence: mergeCloudWithDeviceFiles(cloudForm.evidence, localForm?.evidence || []),
          };
          setForm(next);
          saveLocal(localKey, next);
          localForm = next;
        } else if (localForm) {
          setForm(localForm);
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (localForm) setForm(localForm);
        else setMessage("تعذر الاتصال مؤقتًا. ستتم المزامنة عند الحفظ بعد عودة الشبكة.");
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => { cancelled = true; };
'''

if old not in source:
    if 'onSnapshot(' not in source and 'getDoc(ref)' in source:
        print('portfolio already patched')
    else:
        raise SystemExit('portfolio listener block not found')
else:
    source = source.replace(old, new, 1)

path.write_text(source, encoding="utf-8")

audit = Path("scripts/runtime-audit.mjs")
audit_source = audit.read_text(encoding="utf-8")
marker = "// FINAL_DRAIN_GUARD_PORTFOLIO"
if marker not in audit_source:
    audit_source += '''\n\n// FINAL_DRAIN_GUARD_PORTFOLIO\nforbid(\n  "app/teacher/portfolio/page.tsx",\n  /\\bonSnapshot\\s*\\(|\\bsetInterval\\s*\\(/,\n  "ملف إنجاز المعلم يجب ألا يشغّل listener حيًا أو polling دوريًا أثناء بقاء الصفحة مفتوحة.",\n);\n'''
    audit.write_text(audit_source, encoding="utf-8")

print('portfolio listener cleanup ready')
