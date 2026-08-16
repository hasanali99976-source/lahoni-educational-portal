# خطة العزل الكامل للمعلمين والمواد

## الهدف
عزل بيانات كل معلم ومادة على مستوى التخزين والصلاحيات، وليس على مستوى إخفاء الواجهة فقط.

## الحسابات

| teacherId | المعلم | subjectKey | المادة |
|---|---|---|---|
| `hasan-history` | حسن الطويل | `history` | التاريخ |
| `abdullah-critical-thinking` | عبد الله الرويشد | `critical-thinking` | التفكير الناقد |

## المسار الجديد المقترح

```text
teacherData/{teacherId}/subjects/{subjectKey}/classes/{classId}
teacherData/{teacherId}/subjects/{subjectKey}/students/{studentId}
teacherData/{teacherId}/subjects/{subjectKey}/grades/{gradeId}
teacherData/{teacherId}/subjects/{subjectKey}/research/{researchId}
teacherData/{teacherId}/subjects/{subjectKey}/attendance/{attendanceId}
teacherData/{teacherId}/subjects/{subjectKey}/alerts/{alertId}
```

يمنع هذا التصميم تعارض رقم هوية الطالب عندما يكون الطالب مسجلًا في أكثر من مادة، ويجعل كل استعلام موجهًا لمسار المعلم نفسه بدل قراءة المجموعة العامة كاملة.

## مراحل التنفيذ

1. **هوية الجلسة** — مكتملة
   - الجلسة تعيد `teacherId` و`subjectKey` واسم المادة.
   - توجد دوال موحدة لبناء مسارات المستأجر في `lib/teacher-tenant.ts`.

2. **ترحيل بيانات التاريخ الحالية**
   - نسخ البيانات القديمة إلى مسار `hasan-history/history`.
   - عدم حذف البيانات القديمة قبل التحقق من عدد الطلاب والفصول والدرجات والتنبيهات.

3. **تحويل صفحات المعلم**
   - الطلاب والفصول.
   - الدرجات والبحث.
   - الحضور والمتابعة والتقارير.
   - تنبيهات أولياء الأمور.

4. **بوابة الطالب وولي الأمر**
   - البحث بالكود والمادة داخل فهرس آمن يحدد مسار المعلم الصحيح.
   - منع كشف بيانات مادة أخرى حتى عند تعديل الرابط يدويًا.

5. **قواعد Firestore والمصادقة**
   - العزل الحقيقي يتطلب Firebase Authentication أو تنفيذ القراءة والكتابة عبر API خادمي موثوق.
   - ملف تعريف الارتباط الخاص بـ Next.js لا يمكن لقواعد Firestore رؤيته مباشرة.
   - لا تُفعّل قواعد الإغلاق قبل اكتمال المصادقة والترحيل حتى لا تتوقف البوابة.

## قاعدة الأمان أثناء الترحيل

- لا حذف للبيانات القديمة.
- كل مرحلة تُختبر قبل الانتقال للمرحلة التالية.
- أي كتابة جديدة تحمل `teacherId` و`subjectKey`.
- لا تعتمد الحماية على فلترة JavaScript داخل المتصفح فقط.
