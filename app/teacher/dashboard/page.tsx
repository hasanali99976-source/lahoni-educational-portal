import Link from "next/link";

export default function TeacherDashboardPage() {
  return (
    <main className="shell dashboard">
      <div className="container">
        <section className="card">
          <h1>لوحة المعلم</h1>
          <p>الأستاذ حسن علي الطويل — مادة التاريخ</p>
        </section>
        <section className="cards" style={{marginTop:18}}>
          <Link href="/teacher/students" className="card"><h2>إدارة الطلاب</h2><p>إضافة وتعديل بيانات الطلاب</p></Link>
          <Link href="/teacher/grades" className="card"><h2>رصد الدرجات</h2><p>الوحدات الخمس وعناصر التقييم</p></Link>
          <Link href="/teacher/reports" className="card"><h2>التقارير</h2><p>ملخص النتائج والتقارير</p></Link>
        </section>
      </div>
    </main>
  );
}
