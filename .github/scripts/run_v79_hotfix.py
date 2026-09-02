from pathlib import Path
import subprocess
import sys

patch = Path('.github/scripts/fix_one_page_print_smart_follow_v79.py')
source = patch.read_text(encoding='utf-8')

# The existing level() helper is a single-line function. Prevent the original
# multiline regex from consuming the rest of the follow-up page before the
# selectedStudents anchor is reached.
source = source.replace(
    'r"function level\\(total: number\\) \\{.*?\\n\\}"',
    'r"function level\\(total: number\\) \\{[^\\n]*\\}"',
)

start = source.index("anchor = ")
end = source.index("smart_computed =", start)
robust = '''needle = "  const selectedStudents = referralCandidates.filter(student => selectedIds.includes(student.id));"\nanchor_pos = follow.find(needle)\nif anchor_pos < 0:\n    raise SystemExit("Could not find selectedStudents anchor")\nanchor_end = follow.find("\\n", anchor_pos)\nanchor = follow[anchor_pos:] if anchor_end < 0 else follow[anchor_pos:anchor_end + 1]\n'''
source = source[:start] + robust + source[end:]
patch.write_text(source, encoding='utf-8')
subprocess.run([sys.executable, str(patch)], check=True)
