"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./home.module.css";

const portals = [
  {
    title: "بوابة المعلم",
    subtitle: "إدارة المواد والطلاب والتحضير والدرجات والتقارير والخطط العلاجية.",
    icon: "✎",
    path: "/teacher",
    tone: "teacher",
    points: ["رصد منظم", "تحليل النتائج", "مساعد ذكي"],
  },
  {
    title: "بوابة ولي الأمر / الطالب",
    subtitle: "متابعة المواد والدرجات والحضور والتقارير التعليمية من مكان واحد.",
    icon: "◎",
    path: "/student",
    tone: "student",
    points: ["درجات واضحة", "متابعة الحضور", "خطط علاجية"],
  },
];

export default function HomePage() {
  const router = useRouter();
  const reduced = useReducedMotion();

  return (
    <main className={styles.page} dir="rtl">
      <header className={styles.header}>
        <div className={styles.brand}>
          <Image src="/icons/ostadh-lahooni-192.jpg" width={62} height={62} alt="شعار بوابة أستاذ لحوني التعليمية" priority />
          <div>
            <strong>بوابة أستاذ لحوني التعليمية</strong>
            <small>منصة تعليمية ذكية وواضحة</small>
          </div>
        </div>
        <span className={styles.status}><i /> النظام يعمل بشكل طبيعي</span>
      </header>

      <section className={styles.hero}>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }} className={styles.heroCopy}>
          <span className={styles.eyebrow}>تعليم أسهل • متابعة أدق • قرارات أذكى</span>
          <h1>كل ما يحتاجه المعلم والطالب في بوابة تعليمية واحدة</h1>
          <p>واجهة مرتبة، ألوان مريحة، وصول سريع للمواد والدرجات والحضور والتقارير، مع أدوات ذكاء اصطناعي تساعد المعلم على تحليل النتائج وبناء الخطط العلاجية.</p>
          <div className={styles.features}>
            <span>✓ عزل بيانات كل معلم</span>
            <span>✓ دعم تعدد المواد</span>
            <span>✓ ربط مباشر ببوابة الطالب</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .65 }} className={styles.educationVisual}>
          <div className={styles.visualTop}>
            <span>لوحة تعليمية ذكية</span>
            <b>AI</b>
          </div>
          <div className={styles.visualScene}>
            <span className={styles.book}>📚</span>
            <span className={styles.globe}>🌍</span>
            <span className={styles.chart}>📊</span>
          </div>
          <div className={styles.visualStats}>
            <article><strong>مواد متعددة</strong><small>لكل معلم</small></article>
            <article><strong>تحليل فوري</strong><small>للنتائج</small></article>
            <article><strong>تقارير PDF</strong><small>جاهزة للطباعة</small></article>
          </div>
        </motion.div>
      </section>

      <section className={styles.portalSection}>
        <div className={styles.sectionTitle}>
          <span>ابدأ من هنا</span>
          <h2>اختر بوابتك</h2>
          <p>خياران فقط، واضحان وكبيران.</p>
        </div>
        <div className={styles.portalGrid}>
          {portals.map((portal) => (
            <motion.button key={portal.path} whileHover={reduced ? undefined : { y: -6 }} whileTap={{ scale: .99 }} className={`${styles.portalCard} ${styles[portal.tone]}`} onClick={() => router.push(portal.path)}>
              <span className={styles.portalIcon}>{portal.icon}</span>
              <div className={styles.portalContent}>
                <strong>{portal.title}</strong>
                <p>{portal.subtitle}</p>
                <div className={styles.pointRow}>{portal.points.map(point => <span key={point}>{point}</span>)}</div>
                <b className={styles.enterText}>دخول البوابة ←</b>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <strong>بوابة أستاذ لحوني التعليمية</strong>
        <span>منصة تعليمية متكاملة مدعومة بالذكاء الاصطناعي</span>
      </footer>
    </main>
  );
}
