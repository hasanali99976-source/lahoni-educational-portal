"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./home.module.css";

const subjects = [
  ["🏛️", "التاريخ"], ["🌍", "الجغرافيا"], ["🧪", "العلوم"], ["📐", "الرياضيات"],
  ["🧠", "التفكير الناقد"], ["💻", "التقنية"], ["✍️", "اللغات"], ["📖", "الدراسات الإسلامية"],
  ["🎨", "التربية الفنية"], ["⚽", "التربية البدنية"],
];

export default function HomePage() {
  const router = useRouter();
  return (
    <main className={styles.page} dir="rtl">
      <header className={styles.header}>
        <div className={styles.brand}>
          <Image src="/icons/ostadh-lahooni-192.jpg" width={58} height={58} alt="شعار بوابة أستاذ لحوني التعليمية" priority />
          <div><strong>بوابة أستاذ لحوني التعليمية</strong><small>منصة تعليمية واضحة وسهلة للجميع</small></div>
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => router.push("/admin")}>مدير البوابة</button>
          <button onClick={() => router.push("/teacher")}>دخول المعلم</button>
          <button onClick={() => router.push("/student")}>دخول الطالب</button>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.badge}>تعليم • متابعة • ذكاء</span>
          <h1>منصة تعليمية مرتبة، واضحة، وسهلة الاستخدام</h1>
          <p>كل ما يحتاجه المعلم والطالب في مكان واحد: التحضير، الرصد، التقارير، متابعة الأداء، والمساعد الذكي.</p>
          <div className={styles.heroButtons}>
            <button onClick={() => router.push("/teacher")}>فتح بوابة المعلم</button>
            <button onClick={() => router.push("/student")}>فتح بوابة الطالب / ولي الأمر</button>
          </div>
          <div className={styles.trustRow}><span>✓ خطوط واضحة</span><span>✓ أزرار كبيرة</span><span>✓ تعمل على الجوال</span></div>
        </div>
        <div className={styles.educationScene} aria-hidden="true">
          <div className={styles.board}><b>أستاذ لحوني</b><span>منصة تعليمية ذكية</span></div>
          <div className={styles.books}><i/><i/><i/></div>
          <div className={styles.globe}>🌍</div>
          <div className={styles.lamp}>💡</div>
        </div>
      </section>

      <section className={styles.subjectSection}>
        <div className={styles.sectionHeading}><span>بيئة تعليمية متنوعة</span><h2>جميع المواد بهوية واضحة</h2></div>
        <div className={styles.subjectGrid}>
          {subjects.map(([icon, name]) => <article key={name}><span>{icon}</span><b>{name}</b></article>)}
        </div>
      </section>

      <section className={styles.portalGrid}>
        <button className={styles.teacherCard} onClick={() => router.push("/teacher")}>
          <span className={styles.cardIcon}>👨‍🏫</span><div><small>مساحة العمل</small><h2>بوابة المعلم</h2><p>التحضير والرصد والطلاب والتقارير والذكاء الاصطناعي.</p><b>دخول البوابة ←</b></div>
        </button>
        <button className={styles.studentCard} onClick={() => router.push("/student")}>
          <span className={styles.cardIcon}>🎓</span><div><small>المتابعة التعليمية</small><h2>بوابة الطالب / ولي الأمر</h2><p>المواد والدرجات والحضور والتوصيات التعليمية.</p><b>دخول البوابة ←</b></div>
        </button>
      </section>

      <footer className={styles.footer}>بوابة أستاذ لحوني التعليمية — تعليم واضح وتجربة سهلة</footer>
    </main>
  );
}
