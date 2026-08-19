"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./home.module.css";

const subjects = [
  { key: "history", name: "التاريخ", icon: "🏛️", className: "history" },
  { key: "geography", name: "الجغرافيا", icon: "🌍", className: "geography" },
  { key: "science", name: "العلوم", icon: "⚗️", className: "science" },
  { key: "math", name: "الرياضيات", icon: "∑", className: "math" },
  { key: "thinking", name: "التفكير الناقد", icon: "🧠", className: "thinking" },
  { key: "tech", name: "التقنية", icon: "⌘", className: "tech" },
  { key: "languages", name: "اللغات", icon: "✒️", className: "languages" },
  { key: "islamic", name: "الدراسات الإسلامية", icon: "📖", className: "islamic" },
  { key: "art", name: "التربية الفنية", icon: "🎨", className: "art" },
  { key: "sport", name: "التربية البدنية", icon: "⚽", className: "sport" },
];

const portals = [
  {
    title: "بوابة المعلم",
    subtitle: "إدارة المواد والطلاب والتحضير والدرجات والتقارير والمساعد الذكي.",
    icon: "✎",
    path: "/teacher",
    tone: "teacher",
    points: ["رصد منظم", "تحليل النتائج", "خطة علاجية ذكية"],
  },
  {
    title: "بوابة ولي الأمر / الطالب",
    subtitle: "متابعة المواد والدرجات والحضور والتقارير والتوصيات التعليمية.",
    icon: "◎",
    path: "/student",
    tone: "student",
    points: ["اختيار المادة", "درجات واضحة", "توصيات ذكية"],
  },
];

export default function HomePage() {
  const router = useRouter();
  const reduced = useReducedMotion();

  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.ambientGrid} aria-hidden="true" />
      <div className={styles.lightBeam} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.brand}>
          <Image src="/icons/ostadh-lahooni-192.jpg" width={64} height={64} alt="شعار بوابة أستاذ لحوني التعليمية" priority />
          <div>
            <strong>بوابة أستاذ لحوني التعليمية</strong>
            <small>منصة تجمع المواد في تجربة تعليمية ذكية واحدة</small>
          </div>
        </div>
        <span className={styles.status}><i /> المنصة متصلة وجاهزة</span>
      </header>

      <section className={styles.hero}>
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }} className={styles.heroCopy}>
          <span className={styles.eyebrow}>من المعرفة إلى الفهم • ومن النتائج إلى القرار</span>
          <h1>كل مادة لها عالمها، وكل طالب له طريقه</h1>
          <p>منصة تعليمية حديثة تجمع المعلم والطالب وولي الأمر، وتحوّل كل مادة إلى بيئة بصرية مستقلة مرتبطة بالدرجات والمتابعة والذكاء الاصطناعي.</p>
          <div className={styles.features}>
            <span>✓ هوية مستقلة لكل مادة</span>
            <span>✓ عزل بيانات كل معلم</span>
            <span>✓ ربط مباشر ببوابة الطالب</span>
          </div>
          <div className={styles.quickActions}>
            <button onClick={() => router.push("/teacher")}>دخول المعلم</button>
            <button onClick={() => router.push("/student")}>دخول الطالب / ولي الأمر</button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .7 }} className={styles.knowledgeUniverse}>
          <div className={styles.universeGlow} />
          <div className={styles.aiCore}><span>AI</span><small>ذكاء تعليمي</small></div>
          <div className={styles.bookScene}>
            <div className={styles.bookLeft} />
            <div className={styles.bookRight} />
            <div className={styles.bookSpine} />
            <div className={styles.bookLight} />
          </div>
          <div className={styles.orbitOne} />
          <div className={styles.orbitTwo} />
          {subjects.map((subject, index) => (
            <motion.div
              key={subject.key}
              className={`${styles.subjectNode} ${styles[subject.className]}`}
              style={{ "--i": index } as React.CSSProperties}
              whileHover={reduced ? undefined : { scale: 1.12, zIndex: 8 }}
              title={subject.name}
            >
              <span>{subject.icon}</span>
              <b>{subject.name}</b>
            </motion.div>
          ))}
          <div className={styles.connectionLines} aria-hidden="true" />
        </motion.div>
      </section>

      <section className={styles.portalSection}>
        <div className={styles.sectionTitle}>
          <span>ابدأ رحلتك</span>
          <h2>اختر بوابتك</h2>
          <p>دخول واضح وسريع، ثم تنتقل المنصة تلقائيًا إلى هوية المادة المختارة.</p>
        </div>
        <div className={styles.portalGrid}>
          {portals.map((portal) => (
            <motion.button key={portal.path} whileHover={reduced ? undefined : { y: -7 }} whileTap={{ scale: .99 }} className={`${styles.portalCard} ${styles[portal.tone]}`} onClick={() => router.push(portal.path)}>
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
        <span>تعليم واضح • متابعة دقيقة • ذكاء يخدم التعلم</span>
      </footer>
    </main>
  );
}
