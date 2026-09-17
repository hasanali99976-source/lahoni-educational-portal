from pathlib import Path

path = Path("app/teacher/portfolio/page.tsx")
text = path.read_text(encoding="utf-8")

# Keep the portal's runtime discipline: no permanent Firestore listener/polling.
# Refresh the single portfolio document when this device regains focus/visibility,
# while every save remains a direct cloud write. This gives web/mobile/WebView
# cross-device convergence without reopening the Firestore read-drain.
old_effect = '''    const ref = doc(db, tenantCollection(teacherId, subjectKey as any, "portfolio"), "profile");
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
new_effect = '''    const ref = doc(db, tenantCollection(teacherId, subjectKey as any, "portfolio"), "profile");
    let cancelled = false;
    let refreshing = false;

    const refreshFromCloud = async () => {
      if (cancelled || refreshing) return;
      refreshing = true;
      try {
        const snap = await getDoc(ref);
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
      } catch {
        if (cancelled) return;
        if (localForm) setForm(localForm);
        else setMessage("تعذر الاتصال مؤقتًا. أعد فتح الصفحة بعد عودة الشبكة.");
      } finally {
        refreshing = false;
        if (!cancelled) setLoaded(true);
      }
    };

    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") void refreshFromCloud();
    };

    void refreshFromCloud();
    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
'''

if old_effect not in text:
    raise RuntimeError("portfolio source no longer matches the guarded one-time load block")
text = text.replace(old_effect, new_effect, 1)
path.write_text(text, encoding="utf-8")
print("Portfolio sync now refreshes safely on initial load and device focus/visibility without live listeners.")
