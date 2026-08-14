"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type UnitGrade = {
  attendance: number;
  participation: number;
  research: number;
  test: number;
};

type Student = {
  id: string;
  name?: string;
  nationalId?: string;
  class?: string;
  units?: Record<string, UnitGrade>;
};

const unitOptions = [
  { value: "unit1", label: "الوحدة الأولى" },
  { value: "unit2", label: "الوحدة الثانية" },
  { value: "unit3", label: "الوحدة الثالثة" },
  { value: "unit4", label: "الوحدة الرابعة" },
  { value: "unit5", label: "الوحدة الخامسة" },
];

const emptyGrade: UnitGrade = {
  attendance: 0,
  participation: 0,
  research: 0,
  test: 0,
};

export default function GradesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("unit1");
  const [grades, setGrades] = useState<Record<string, UnitGrade>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [maxGrades, setMaxGrades] = useState<UnitGrade>({
    attendance: 10,
    participation: 5,
    research: 5,
    test: 10,
  });

  useEffect(
    () =>
      onSnapshot(collection(db, "students"), (snapshot) => {
        const list = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Student[];

        list.sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "ar")
        );
        setStudents(list);
      }),
    []
  );

  const classes = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .map((student) => (student.class || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, "ar")),
    [students]
  );

  const classStudents = useMemo(
    () =>
      students.filter(
        (student) => (student.class || "").trim() === selectedClass
      ),
    [students, selectedClass]
  );

  useEffect(() => {
    const nextGrades: Record<string, UnitGrade> = {};

    for (const student of classStudents) {
      nextGrades[student.id] = {
        ...emptyGrade,
        ...(student.units?.[selectedUnit] || {}),
      };
    }

    setGrades(nextGrades);
    setMessage("");
  }, [classStudents, selectedUnit]);

  function setStudentGrade(
    studentId: string,
    key: keyof UnitGrade,
    rawValue: string
  ) {
    const maximum = maxGrades[key];
    const parsed = Number(rawValue);
    const value = Number.isFinite(parsed)
      ? Math.max(0, Math.min(maximum, parsed))
      : 0;

    setGrades((current) => ({
      ...current,
      [studentId]: {
        ...(current[studentId] || emptyGrade),
        [key]: value,
      },
    }));
  }

  function setMaximum(key: keyof UnitGrade, rawValue: string) {
    const parsed = Number(rawValue);
    const value = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;

    setMaxGrades((current) => ({
      ...current,
      [key]: value,
    }));

    setGrades((current) => {
      const next: Record<string, UnitGrade> = {};
      for (const [studentId, grade] of Object.entries(current)) {
        next[studentId] = {
          ...grade,
          [key]: Math.min(grade[key], value),
        };
      }
      return next;
    });
  }

  function giveFullGrade(key: keyof UnitGrade) {
    setGrades((current) => {
      const next = { ...current };
      for (const student of classStudents) {
        next[student.id] = {
          ...(next[student.id] || emptyGrade),
          [key]: maxGrades[key],
        };
      }
      return next;
    });
  }

  function totalFor(grade: UnitGrade) {
    return (
      grade.attendance +
      grade.participation +
      grade.research +
      grade.test
    );
  }

  const maximumTotal =
    maxGrades.attendance +
    maxGrades.participation +
    maxGrades.research +
    maxGrades.test;

  async function saveAll() {
    if (!selectedClass) {
      setMessage("اختر الفصل أولًا");
      return;
    }

    if (!classStudents.length) {
      setMessage("لا يوجد طلاب في هذا الفصل");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      await Promise.all(
        classStudents.map((student) => {
          const grade = grades[student.id] || emptyGrade;
          const total = totalFor(grade);
          const percentage = maximumTotal
            ? Math.round((total / maximumTotal) * 1000) / 10
            : 0;

          return updateDoc(doc(db, "students", student.id), {
            [`units.${selectedUnit}`]: {
              ...grade,
              total,
              maximumTotal,
              percentage,
              maxGrades,
            },
          });
        })
      );

      setMessage(
        `تم حفظ درجات ${unitOptions.find((u) => u.value === selectedUnit)?.label} للفصل ${selectedClass}`
      );
    } catch (error) {
      console.error(error);
      setMessage("تعذر حفظ الدرجات. تحقق من الاتصال وقواعد Firebase");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell dashboard">
      <div className="container">
        <section className="card">
          <h1>رصد الدرجات</h1>
          <p>اختر الفصل والوحدة، ثم أدخل درجات الطلاب.</p>

          <div className="form-grid">
            <label>
              الفصل
              <select
                className="field"
                value={selectedClass}
                onChange={(event) => setSelectedClass(event.target.value)}
              >
                <option value="">اختر الفصل</option>
                {classes.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </label>

            <label>
              الوحدة
              <select
                className="field"
                value={selectedUnit}
                onChange={(event) => setSelectedUnit(event.target.value)}
              >
                {unitOptions.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="summary-box">
              <strong>عدد الطلاب: {classStudents.length}</strong>
              <span>المجموع الأعلى: {maximumTotal}</span>
            </div>
          </div>
        </section>

        <section className="card" style={{ marginTop: 18 }}>
          <h2>تحديد أعلى درجة</h2>
          <div className="grade-grid">
            {(
              [
                ["attendance", "الحضور"],
                ["participation", "المشاركة"],
                ["research", "البحث"],
                ["test", "الاختبار"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  className="field"
                  type="number"
                  min="0"
                  value={maxGrades[key]}
                  onChange={(event) => setMaximum(key, event.target.value)}
                />
                <button
                  type="button"
                  className="small-btn edit"
                  onClick={() => giveFullGrade(key)}
                  disabled={!selectedClass}
                >
                  إعطاء الدرجة كاملة للجميع
                </button>
              </label>
            ))}
          </div>
        </section>

        <section className="card" style={{ marginTop: 18 }}>
          <div className="toolbar">
            <div>
              <h2>
                {selectedClass || "لم يتم اختيار فصل"} — {" "}
                {unitOptions.find((unit) => unit.value === selectedUnit)?.label}
              </h2>
              <p>الطلاب مرتّبون أبجديًا.</p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>اسم الطالب</th>
                  <th>الحضور / {maxGrades.attendance}</th>
                  <th>المشاركة / {maxGrades.participation}</th>
                  <th>البحث / {maxGrades.research}</th>
                  <th>الاختبار / {maxGrades.test}</th>
                  <th>المجموع / {maximumTotal}</th>
                  <th>النسبة</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map((student, index) => {
                  const grade = grades[student.id] || emptyGrade;
                  const total = totalFor(grade);
                  const percentage = maximumTotal
                    ? Math.round((total / maximumTotal) * 1000) / 10
                    : 0;

                  return (
                    <tr key={student.id}>
                      <td>{index + 1}</td>
                      <td>{student.name}</td>
                      {(
                        [
                          "attendance",
                          "participation",
                          "research",
                          "test",
                        ] as const
                      ).map((key) => (
                        <td key={key}>
                          <input
                            className="grade-input"
                            type="number"
                            min="0"
                            max={maxGrades[key]}
                            value={grade[key]}
                            onChange={(event) =>
                              setStudentGrade(
                                student.id,
                                key,
                                event.target.value
                              )
                            }
                          />
                        </td>
                      ))}
                      <td>
                        <strong>{total}</strong>
                      </td>
                      <td>{percentage}%</td>
                    </tr>
                  );
                })}

                {!selectedClass && (
                  <tr>
                    <td colSpan={8}>اختر الفصل لعرض الطلاب</td>
                  </tr>
                )}

                {selectedClass && !classStudents.length && (
                  <tr>
                    <td colSpan={8}>لا يوجد طلاب في هذا الفصل</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            className="btn primary"
            style={{ marginTop: 18, width: "100%" }}
            onClick={saveAll}
            disabled={saving || !selectedClass}
          >
            {saving ? "جارٍ حفظ الدرجات..." : "حفظ درجات الفصل"}
          </button>

          {message && <p className="notice">{message}</p>}
        </section>
      </div>
    </main>
  );
}
