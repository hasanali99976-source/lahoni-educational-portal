from pathlib import Path
import subprocess
import sys

patch = Path('.github/scripts/fix_one_page_print_smart_follow_v79.py')
source = patch.read_text(encoding='utf-8')
start = source.index("anchor = ")
end = source.index("smart_computed =", start)
robust = '''anchor_match = re.search(r"  const selectedStudents = referralCandidates\\.filter\\(student => selectedIds\\.includes\\(student\\.id\\)\\);\\s*", follow)\nif not anchor_match:\n    raise SystemExit("Could not find selectedStudents anchor")\nanchor = anchor_match.group(0)\n'''
source = source[:start] + robust + source[end:]
patch.write_text(source, encoding='utf-8')
subprocess.run([sys.executable, str(patch)], check=True)
