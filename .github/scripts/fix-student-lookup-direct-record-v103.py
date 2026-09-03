from pathlib import Path

path = Path('app/api/student/lookup/route.ts')
text = path.read_text(encoding='utf-8')

old = '''    const repairWrites: Array<{ path: string; data: Record<string, unknown> }> = [];
    const located = [...chosenBySubject.values()].map(candidate => {
      if (candidate.existing) return candidate.existing;
      const data = {
        ...student,
        id: accessCode,
        code: accessCode,
        accessCode,
        studentCode: accessCode,
        class: canonicalClassName(student.grade, student.section),
        className: canonicalClassName(student.grade, student.section),
        teacherId: candidate.teacherId,
        subjectKey: candidate.subjectId,
        active: true,
        rosterActive: true,
      } as Record<string, unknown>;
      repairWrites.push({
        path: `portalV2Data/${candidate.teacherId}/subjects/${candidate.subjectId}/students/${accessCode}`,
        data: {
          ...data,
          linkedFromCentralRoster: true,
          linkedByGradeFallback: !candidate.matchedClass,
          updatedAt: new Date().toISOString(),
        },
      });
      return { studentId: accessCode, teacherId: candidate.teacherId, subjectId: candidate.subjectId, data };
    });
'''

new = '''    const directStudentByTeacherSubject = new Map<string, LocatedStudent>();
    await Promise.all([...chosenBySubject.values()].map(async candidate => {
      try {
        const snapshot = await adminDb()
          .collection(`portalV2Data/${candidate.teacherId}/subjects/${candidate.subjectId}/students`)
          .doc(accessCode)
          .get();
        if (!snapshot.exists) return;
        directStudentByTeacherSubject.set(`${candidate.teacherId}:${candidate.subjectId}`, {
          studentId: snapshot.id,
          teacherId: candidate.teacherId,
          subjectId: candidate.subjectId,
          data: snapshot.data() as Record<string, unknown>,
        });
      } catch (directStudentError) {
        console.warn("direct student record lookup deferred", directStudentError);
      }
    }));

    const repairWrites: Array<{ path: string; data: Record<string, unknown> }> = [];
    const located = [...chosenBySubject.values()].map(candidate => {
      const directStudent = directStudentByTeacherSubject.get(`${candidate.teacherId}:${candidate.subjectId}`);
      if (directStudent) return directStudent;
      if (candidate.existing) return candidate.existing;
      const data = {
        ...student,
        id: accessCode,
        code: accessCode,
        accessCode,
        studentCode: accessCode,
        class: canonicalClassName(student.grade, student.section),
        className: canonicalClassName(student.grade, student.section),
        teacherId: candidate.teacherId,
        subjectKey: candidate.subjectId,
        active: true,
        rosterActive: true,
      } as Record<string, unknown>;
      repairWrites.push({
        path: `portalV2Data/${candidate.teacherId}/subjects/${candidate.subjectId}/students/${accessCode}`,
        data: {
          ...data,
          linkedFromCentralRoster: true,
          linkedByGradeFallback: !candidate.matchedClass,
          updatedAt: new Date().toISOString(),
        },
      });
      return { studentId: accessCode, teacherId: candidate.teacherId, subjectId: candidate.subjectId, data };
    });
'''

if old not in text:
    raise SystemExit('target block not found')

text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('patched student lookup direct record fallback v103')
