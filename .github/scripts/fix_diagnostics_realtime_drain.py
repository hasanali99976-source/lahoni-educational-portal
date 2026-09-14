from pathlib import Path

root = Path(__file__).resolve().parents[2]


def replace_once(path: str, old: str, new: str):
    target = root / path
    text = target.read_text(encoding="utf-8")
    if old not in text:
        if new in text:
            print(f"already patched: {path}")
            return
        raise SystemExit(f"pattern not found in {path}: {old[:120]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"patched: {path}")


# Diagnostics list: replace a live collection listener with a one-shot load.
replace_once(
    "app/teacher/diagnostics/page.tsx",
    'import { collection, doc, getDocs, onSnapshot, query, setDoc, where, writeBatch } from "firebase/firestore";',
    'import { collection, doc, getDocs, query, setDoc, where, writeBatch } from "firebase/firestore";',
)
replace_once(
    "app/teacher/diagnostics/page.tsx",
    '''  useEffect(() => {\n    setDiagnosticsLoaded(false);\n    if (!path) return;\n    return onSnapshot(collection(db, path), snapshot => {\n      setItems(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Diagnostic, "id">) })));\n      setDiagnosticsLoaded(true);\n    });\n  }, [path]);''',
    '''  useEffect(() => {\n    setDiagnosticsLoaded(false);\n    if (!path) return;\n    let cancelled = false;\n    void getDocs(collection(db, path))\n      .then(snapshot => {\n        if (cancelled) return;\n        setItems(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Diagnostic, "id">) })));\n      })\n      .catch(() => {\n        if (!cancelled) setItems([]);\n      })\n      .finally(() => {\n        if (!cancelled) setDiagnosticsLoaded(true);\n      });\n    return () => { cancelled = true; };\n  }, [path]);''',
)

# Diagnostic results: stop the live listener and the 8-second backup polling loop.
replace_once(
    "app/teacher/diagnostics/diagnostic-results.tsx",
    'import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";',
    'import { collection, doc, getDocs, updateDoc } from "firebase/firestore";',
)
replace_once(
    "app/teacher/diagnostics/diagnostic-results.tsx",
    '''  useEffect(() => onSnapshot(collection(db, resultsPath), snapshot => {\n    setResults(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Result, "id">) })));\n  }, () => setResults([])), [resultsPath]);''',
    '''  useEffect(() => {\n    let cancelled = false;\n    void getDocs(collection(db, resultsPath))\n      .then(snapshot => {\n        if (!cancelled) setResults(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Result, "id">) })));\n      })\n      .catch(() => {\n        if (!cancelled) setResults([]);\n      });\n    return () => { cancelled = true; };\n  }, [resultsPath]);''',
)
replace_once(
    "app/teacher/diagnostics/diagnostic-results.tsx",
    '''    void loadBackups();\n    const timer = window.setInterval(loadBackups, 8000);\n    return () => {\n      cancelled = true;\n      window.clearInterval(timer);\n    };''',
    '''    void loadBackups();\n    return () => {\n      cancelled = true;\n    };''',
)

# Add permanent audit guards so these high-read patterns cannot return unnoticed.
audit = root / "scripts/runtime-audit.mjs"
text = audit.read_text(encoding="utf-8")
marker = "// FINAL_DRAIN_GUARD_DIAGNOSTICS"
if marker not in text:
    text += r'''

// FINAL_DRAIN_GUARD_DIAGNOSTICS
// Diagnostic screens must never restore live collection listeners or short polling loops.
forbid(
  "app/teacher/diagnostics/page.tsx",
  /\bonSnapshot\s*\(/,
  "صفحة الاختبارات التشخيصية يجب ألا تشغّل listener حيًا على مجموعة الاختبارات.",
);
forbid(
  "app/teacher/diagnostics/diagnostic-results.tsx",
  /\bonSnapshot\s*\(|setInterval\s*\(|(?:8_?000|8000)/,
  "نتائج الاختبارات التشخيصية يجب ألا تستخدم listener حيًا أو polling دوريًا كل عدة ثوانٍ.",
);
'''
    audit.write_text(text, encoding="utf-8")
    print("patched: scripts/runtime-audit.mjs")
else:
    print("already patched: scripts/runtime-audit.mjs")
