"use client";

import "./dashboard.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import TeacherShell from "../../../components/teacher-shell";
import {
  UsersIcon,
  BookIcon,
  ChartIcon,
  CalendarCheckIcon,
  TableIcon,
  ArrowIcon,
} from "../../../components/icons";

type Student = { id: string; class?: string; units?: Record<string, { percentage?: number }> };

export default function TeacherDashboardPage() {
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(
    () =>
      onSnapshot(collection(db, "students"), (snapshot) => {
        setStudents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Student[]);
      }),
    [],
  );

  const classes = useMemo(
    () => new Set(students.map((student) => student.class).filter(Boolean)).size,
    [students],
  );

  const average = useMemo(() => {
    const values = students.flatMap((student) =>
      Object.values(student.units || {})
        .map((unit) => Number(unit.percentage || 0))
        .filter((value) => value > 0),
    );
    return values.length
      ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
      : 0;
  }, [students]);

  return (
    <TeacherShell
      title="لوحة المعلم"
      subtitle="متابعة مادة التاريخ — الصف الثاني الثانوي"
    >
      <div className="stack-lg">
        <section className="welcome-banner animate-in">
          <div className="wb-copy">
            <span className="eyebrow">مرحبًا بك من جديد</span>
            <h1>الأستاذ حسن علي الطويل</h1>
            <p className="wb-role">معلم التاريخ</p>
            <span className="wb-school">
              <BookIcon style={{ width: 16, height: 16 }} />
              مدرسة التهذيب الثانوية
            </span>
            <div className="wb-actions">
              <Link href="/teacher/grades" className="btn ghost">
                <TableIcon style={{ width: 18, height: 18 }} />
                ابدأ رصد الدرجات
              </Link>
              <Link href="/teacher/attendance" className="btn on-brand">
                <CalendarCheckIcon style={{ width: 18, height: 18 }} />
                التحضير اليومي
              </Link>
            </div>
          </div>
          <div className="wb-photo">
            <img src="/portal.png" alt="الأستاذ حسن علي الطويل معلم مادة التاريخ" />
          </div>
        </section>

        <section className="stat-grid">
          <article className="stat animate-in">
            <div className="stat-icon teal">
              <UsersIcon />
            </div>
            <div>
              <div className="stat-label">إجمالي الطلاب</div>
              <div className="stat-value">{students.length}</div>
            </div>
          </article>
          <article className="stat animate-in">
            <div className="stat-icon blue">
              <BookIcon />
            </div>
            <div>
              <div className="stat-label">عدد الفصول</div>
              <div className="stat-value">{classes}</div>
            </div>
          </article>
          <article className="stat animate-in">
            <div className="stat-icon green">
              <ChartIcon />
            </div>
            <div>
              <div className="stat-label">متوسط الأداء</div>
              <div className="stat-value">{average}%</div>
            </div>
          </article>
          <article className="stat animate-in">
            <div className="stat-icon amber">
              <CalendarCheckIcon />
            </div>
            <div>
              <div className="stat-label">الوحدات الدراسية</div>
              <div className="stat-value">٥</div>
            </div>
          </article>
        </section>

        <div className="section-title">
          <div>
            <h2>الوصول السريع</h2>
            <p>اختر المهمة التي تريد تنفيذها الآن</p>
          </div>
        </div>

        <section className="quick-grid">
          <Link href="/teacher/students" className="quick-card animate-in">
            <span className="q-icon teal">
              <UsersIcon />
            </span>
            <div>
              <h3>إدارة الطلاب</h3>
              <p>الفصول، الإضافة، التعديل والاستيراد</p>
            </div>
            <ArrowIcon className="q-arrow" />
          </Link>

          <Link href="/teacher/attendance" className="quick-card animate-in">
            <span className="q-icon green">
              <CalendarCheckIcon />
            </span>
            <div>
              <h3>التحضير اليومي</h3>
              <p>تسجيل الحضور والغياب حسب التاريخ</p>
            </div>
            <ArrowIcon className="q-arrow" />
          </Link>

          <Link href="/teacher/grades" className="quick-card animate-in">
            <span className="q-icon blue">
              <TableIcon />
            </span>
            <div>
              <h3>رصد الدرجات</h3>
              <p>كشف درجات احترافي بحسابات تلقائية</p>
            </div>
            <ArrowIcon className="q-arrow" />
          </Link>

          <Link href="/teacher/reports" className="quick-card animate-in">
            <span className="q-icon amber">
              <ChartIcon />
            </span>
            <div>
              <h3>التقارير</h3>
              <p>ملخصات الطلاب والفصول والطباعة</p>
            </div>
            <ArrowIcon className="q-arrow" />
          </Link>
        </section>
      </div>
    </TeacherShell>
  );
}
