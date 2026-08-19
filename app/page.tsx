"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./home.module.css";

const portals = [
  {
    title: "بوابة المعلم",
    subtitle: "إدارة المواد والطلاب والدرجات والتقارير",
    icon: "🧑‍🏫",
    path: "/teacher",
    tone: "teacher",
  },
  {
    title: "بوابة ولي الأمر / الطالب",
    subtitle: "متابعة المواد والدرجات والحضور والتنبيهات",
    icon: "🎓",
    path: "/student",
    tone: "student",
  },
];

export default function HomePage() {
  const router = useRouter();
  const reduced = useReducedMotion();

  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.orbOne} />
      <div className={styles.orbTwo} />

      <header className={styles.nav}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>ح</div>
          <div>
            <strong>بوابة أستاذ لحوني التعليمية</strong>
            <small>منصة تعليمية ذكية</small>
          </div>
        </div>
      </header>

      <section className={styles.hero}>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={styles.heroCopy}
        >
          <span className={styles.badge}>تعليم ذكي • متابعة واضحة • تجربة موحدة</span>
          <h1>اختر بوابتك للدخول</h1>
          <p>بوابتان فقط، واضحتان وكبيرتان، للوصول السريع إلى جميع خدمات المنصة.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.65 }}
          className={styles.aiPanel}
        >
          <div className={styles.aiGlow} />
          <div className={styles.brain}>🧠</div>
          <div className={`${styles.floatCard} ${styles.cardOne}`}>📊 تحليل تعليمي ذكي</div>
          <div className={`${styles.floatCard} ${styles.cardTwo}`}>✨ متابعة لحظية</div>
          <div className={styles.assistant}>
            <span>مساعد لحوني التعليمي</span>
            <strong>مرحبًا بك في منصتك الذكية</strong>
          </div>
        </motion.div>
      </section>

      <section className={styles.portalSection}>
        <div className={styles.portalGrid}>
          {portals.map((portal) => (
            <motion.button
              key={portal.path}
              whileHover={reduced ? undefined : { y: -10, scale: 1.015 }}
              whileTap={{ scale: 0.99 }}
              transition={{ duration: 0.2 }}
              className={`${styles.portalCard} ${styles[portal.tone]}`}
              onClick={() => router.push(portal.path)}
            >
              <span className={styles.portalIcon}>{portal.icon}</span>
              <div>
                <strong>{portal.title}</strong>
                <p>{portal.subtitle}</p>
                <span className={styles.enterText}>دخول البوابة ←</span>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <strong>بوابة أستاذ لحوني التعليمية</strong>
        <span>تعليم أوضح • متابعة أدق • أثر أكبر</span>
      </footer>
    </main>
  );
}
