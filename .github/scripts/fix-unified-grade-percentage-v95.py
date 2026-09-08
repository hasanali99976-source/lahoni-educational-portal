from pathlib import Path

path = Path('app/teacher/grades/page.tsx')
text = path.read_text(encoding='utf-8')
old = 'function adjustedResult(student:Student){const result=calculateGradePlanResult(activePlan!,effectiveStudent(student));const deduction=totalDeductionFor(student);const earned=Math.max(0,roundGrade(result.earned-deduction));const availableMaximum=Math.max(0,roundGrade(result.maximum-deduction));const percentage=availableMaximum?Math.round((earned/availableMaximum)*100):0;return{result,earned,percentage,deduction,availableMaximum};}'
new = 'function adjustedResult(student:Student){const result=calculateGradePlanResult(activePlan!,effectiveStudent(student));const deduction=totalDeductionFor(student);const earned=Math.max(0,roundGrade(result.earned-deduction));const availableMaximum=Math.max(0,roundGrade(result.maximum-deduction));const percentage=result.maximum?Math.max(0,Math.round((earned/result.maximum)*100)):0;return{result,earned,percentage,deduction,availableMaximum};}'
if old not in text:
    raise SystemExit('target adjustedResult calculation not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Updated teacher grade percentage to remain out of the original 100-point maximum.')
