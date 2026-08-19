"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./home.module.css";

const portals = [
  { title: "بوابة المعلم", text: "إدارة المواد والطلاب والدرجات والتقارير من لوحة موحدة.", icon: "🧑‍🏫", path: "/teacher", tone: "teacher" },
  { title: "بوابة ولي الأمر / الطالب", text: "دخول موحد لمتابعة المواد والدرجات والحضور والتنبيهات.", icon: "🎓", path: "/student", tone: "student" },
];

const features = [
  ["🧠", "مساعد تعليمي ذكي", "إرشادات فورية لفهم الأداء واختيار الخطوة التعليمية التالية."],
  ["📊", "تقارير واضحة", "قراءة مباشرة للدرجات والحضور والتقدم دون تعقيد."],
  ["📚", "تعلم منظم", "المواد والواجبات والمتابعة في تجربة موحدة لكل مستخدم."],
];

export default function HomePage() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const enter = (path: string) => router.push(path);

  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.orbOne} />
      <div className={styles.orbTwo} />
      <header className={styles.nav}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>ح</div>
          <div><strong>أستاذ لحوني</strong><small>المنصة التعليمية الذكية</small></div>
        </div>
        <div className={styles.navLinks}>
          <a href="#features">المميزات</a>
          <a href="#portals">الدخول</a>
          <button onClick={() => enter("/teacher")}>بوابة المعلم</button>
        </div>
      </header>

      <section className={styles.hero}>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }} className={styles.heroCopy}>
          <span className={styles.badge}>تعليم ومتابعة مدعومان بالإرشاد الذكي</span>
          <h1>منصة واحدة، تعليم أوضح، ومتابعة أذكى.</h1>
          <p>بوابة موحدة تربط المعلم بالطالب وولي الأمر، وتجمع المواد والدرجات والحضور والتقارير في تجربة واضحة وسريعة.</p>
          <div className={styles.heroActions}>
            <button className={styles.primary} onClick={() => enter("/teacher")}>دخول المعلم</button>
            <button className={styles.secondary} onClick={() => enter("/student")}>دخول ولي الأمر / الطالب</button>
          </div>
          <div className={styles.miniStats}>
            <span><b>ذكية</b><small>إرشاد وتحليل</small></span>
            <span><b>موحدة</b><small>طالب وولي أمر</small></span>
            <span><b>تعليمية</b><small>مواد ومتابعة</small></span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .7 }} className={styles.aiPanel}>
          <div className={styles.aiGlow} />
          <div className={styles.brain}>🧠</div>
          <div className={`${styles.floatCard} ${styles.cardOne}`}>📈 تحليل مستوى التقدم</div>
          <div className={`${styles.floatCard} ${styles.cardTwo}`}>✓ اقتراح خطوة تعليمية</div>
          <div className={`${styles.floatCard} ${styles.cardThree}`}>⚡ تنبيه مبكر</div>
          <div className={styles.assistant}><span>مساعد لحوني التعليمي</span><strong>اسألني عن الدرجات والحضور وخطة التحسن</strong></div>
        </motion.div>
      </section>

      <section id="portals" className={styles.portalSection}>
        <div className={styles.sectionHead}><span>الدخول الموحد</span><h2>بوابتان واضحتان فقط</h2></div>
        <div className={styles.portalGrid}>
          {portals.map((portal) => (
            <motion.button key={portal.path} whileHover={reduced ? undefined : { y: -7, scale: 1.01 }} transition={{ duration: .2 }} className={`${styles.portalCard} ${styles[portal.tone]}`} onClick={() => enter(portal.path)}>
              <span className={styles.portalIcon}>{portal.icon}</span>
              <div><strong>{portal.title}</strong><p>{portal.text}</p></div>
              <b className={styles.arrow}>←</b>
            </motion.button>
          ))}
        </div>
      </section>

      <section id="features" className={styles.features}>
        {features.map(([icon, title, text]) => <article key={title}><span>{icon}</span><div><strong>{title}</strong><p>{text}</p></div></article>)}
      </section>

      <section className={styles.smartStrip}>
        <div><span>منصة تعليمية متكاملة</span><h2>المادة من المعلم، والمتابعة للطالب وولي الأمر.</h2><p>اختيار المواد، متابعة النتائج، والتنبيهات الذكية في مكان واحد.</p></div>
        <button onClick={() => enter("/student")}>دخول ولي الأمر / الطالب</button>
      </section>

      <footer className={styles.footer}><strong>بوابة أستاذ لحوني التعليمية</strong><span>تعليم أوضح • متابعة أدق • أثر أكبر</span></footer>
    </main>
  );
}
