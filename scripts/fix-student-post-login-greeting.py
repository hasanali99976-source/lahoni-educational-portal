from pathlib import Path

path = Path("app/student/page.tsx")
text = path.read_text(encoding="utf-8")
old = '    if (shouldSpeak) speakLoginGreeting("student");\n'
new = '    // Voice greeting is intentionally delayed until the student portal and real name are visible.\n    void shouldSpeak;\n'
if old not in text:
    raise SystemExit("student pre-login greeting marker not found")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("Patched student greeting to run only after portal identity is available.")
