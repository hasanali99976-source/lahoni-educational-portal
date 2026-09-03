from pathlib import Path

path = Path('app/teacher/attendance/page.tsx')
text = path.read_text(encoding='utf-8')

old = '''      const weekDates = schoolWeekDates(selectedDate).filter(day => day >= ATTENDANCE_START_DATE);'''
new = '''      const weekAnchor = reportFrom || selectedDate;
      const weekDates = schoolWeekDates(weekAnchor).filter(day => day >= ATTENDANCE_START_DATE);'''
if old not in text:
    raise SystemExit('weekly anchor pattern not found')
text = text.replace(old, new, 1)

old2 = '''<div className="attendance-range-content"><p>يعرض تواريخ الغياب والتأخير والاستئذان والهروب لكل طالب خلال الفترة، ويمكن تحميله بصيغتي Excel وPDF.</p><div className="attendance-range-controls">'''
new2 = '''<div className="attendance-range-content"><p>يعرض تواريخ الغياب والتأخير والاستئذان والهروب لكل طالب خلال الفترة، ويمكن تحميله بصيغتي Excel وPDF. وللتقرير الأسبوعي اختر أي تاريخ من الأسبوع المطلوب في خانة «من تاريخ» ثم اضغط PDF أسبوعي.</p><div className="attendance-range-controls">'''
if old2 not in text:
    raise SystemExit('range help pattern not found')
text = text.replace(old2, new2, 1)

old3 = '''setMessage(`تم تجهيز التقرير الأسبوعي لجميع الفصول: ${classes.length} فصل، ولكل فصل لون مستقل.`);'''
new3 = '''setMessage(`تم تجهيز التقرير الأسبوعي ${weekDates[0]} إلى ${weekDates.at(-1)} لجميع الفصول: ${classes.length} فصل، ولكل فصل لون مستقل.`);'''
if old3 not in text:
    raise SystemExit('weekly message pattern not found')
text = text.replace(old3, new3, 1)

path.write_text(text, encoding='utf-8')
