"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./home.module.css";

const portals = [
  { title: "بوابة المعلم", text: "إدارة المواد والطلاب والدرجات والتقارير.", icon: "🧑‍🏫", path: "/teacher", tone: "teacher" },
  { title: "بوابة الطالب", text: "متابعة المواد والدرجات والحضور والتنبيهات.", icon: "🎓", path: "/student", tone: "student" },
  { title: "بوابة ولي الأمر", text: "متابعة الأبناء والمواد ومستوى التقدم.", icon: "👨‍👩‍👦", path: "/parent", tone: "parent" },
];

const features = [
  ["🧠", "تحليل ذكي", "قراءة أوضح للأداء ونقاط القوة والتحسن."],
  ["📊", "تقارير لحظية", "بيانات مباشرة تساعد المعلم وولي الأمر."],
  ["✨", "تجربة سهلة", "تصميم واضح وسريع على الجوال والكمبيوتر."],
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
          <a href="#portals">البوابات</a>
          <button onClick={() => enter("/teacher")}>تسجيل الدخول</button>
        </div>
      </header>

      <section className={styles.hero}>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }} className={styles.heroCopy}>
          <span className={styles.badge}>منصة تعليمية مدعومة بالذكاء الاصطناعي</span>
          <h1>تعليم أذكى، متابعة أوضح، ونتائج أفضل.</h1>
          <p>منصة موحدة للمعلم والطالب وولي الأمر، تجمع المواد والدرجات والحضور والتقارير في تجربة حديثة وسهلة.</p>
          <div className={styles.heroActions}>
            <button className={styles.primary} onClick={() => enter("/teacher")}>ابدأ من بوابة المعلم</button>
            <button className={styles.secondary} onClick={() => enter("/student")}>دخول الطالب</button>
          </div>
          <div className={styles.miniStats}>
            <span><b>ذكية</b><small>تحليل ومتابعة</small></span>
            <span><b>موحدة</b><small>كل البوابات</small></span>
            <span><b>سريعة</b><small>على كل الأجهزة</small></span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .7 }} className={styles.aiPanel}>
          <div className={styles.aiGlow} />
          <div className={styles.brain}>🧠</div>
          <div className={`${styles.floatCard} ${styles.cardOne}`}>📈 تقدم الطالب <b>+18%</b></div>
          <div className={`${styles.floatCard} ${styles.cardTwo}`}>✓ متابعة فورية</div>
          <div className={`${styles.floatCard} ${styles.cardThree}`}>⚡ تنبيه ذكي</div>
          <div className={styles.assistant}>
            <span>مساعد لحوني الذكي</span>
            <strong>كيف أقدر أخدمك اليوم؟</strong>
          </div>
        </motion.div>
      </section>

      <section id="portals" className={styles.portalSection}>
        <div className={styles.sectionHead}><span>البوابات</span><h2>كل مستخدم له تجربة واضحة ومستقلة</h2></div>
        <div className={styles.portalGrid}>
          {portals.map((portal, index) => (
            <motion.button key={portal.path} whileHover={reduced ? undefined : { y: -7, scale: 1.01 }} transition={{ duration: .2 }} className={`${styles.portalCard} ${styles[portal.tone]}`} onClick={() => enter(portal.path)}>
              <span className={styles.portalIcon}>{portal.icon}</span>
              <div><strong>{portal.title}</strong><p>{portal.text}</p></div>
              <b className={styles.arrow}>←</b>
            </motion.button>
          ))}
        </div>
      </section>

      <section id="features" className={styles.features}>
        {features.map(([icon, title, text]) => (
          <article key={title}><span>{icon}</span><div><strong>{title}</strong><p>{text}</p></div></article>
        ))}
      </section>

      <section className={styles.smartStrip}>
        <div><span>جاهز للتطوير</span><h2>منصة واحدة تجمع التعليم والمتابعة والذكاء.</h2><p>ابدأ من بوابتك، واختر موادك، وتابع التقدم من مكان واحد.</p></div>
        <button onClick={() => enter("/teacher")}>الدخول الآن</button>
      </section>

      <footer className={styles.footer}><strong>بوابة أستاذ لحوني التعليمية</strong><span>تعليم أوضح • متابعة أدق • أثر أكبر</span></footer>
    </main>
  );
}
