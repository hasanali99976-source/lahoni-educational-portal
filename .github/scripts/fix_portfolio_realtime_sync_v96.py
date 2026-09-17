from pathlib import Path

path = Path("app/teacher/portfolio/page.tsx")
text = path.read_text(encoding="utf-8")

old_import = 'import { doc, getDoc, setDoc } from "firebase/firestore";'
new_import = 'import { doc, onSnapshot, setDoc } from "firebase/firestore";'
if old_import not in text:
    raise RuntimeError("portfolio firestore import no longer matches expected source")
text = text.replace(old_import, new_import, 1)

old = '''    const ref = doc(db, tenantCollection(teacherId, subjectKey as any, "portfolio"), "profile");
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
new = '''    const ref = doc(db, tenantCollection(teacherId, subjectKey as any, "portfolio"), "profile");
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
        else setMessage("تعذر الاتصال مؤقتًا. ستعود المزامنة عند توفر الشبكة.");
        setLoaded(true);
      },
    );

    return unsubscribe;
'''
if old not in text:
    raise RuntimeError("portfolio one-time cloud load block no longer matches expected source")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("Portfolio now subscribes only to its single profile document and unsubscribes on unmount.")
