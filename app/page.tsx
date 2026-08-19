"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import styles from "./home.module.css";
import { motion, useReducedMotion } from "framer-motion";

const QRCodeSVG = dynamic(() => import("qrcode.react").then(m => m.QRCodeSVG), { ssr: false });
const studentUrl = "https://tahdheeb-history.vercel.app/student";

function playEntryTone() {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    [523.25, 659.25, 783.99].forEach((f: number, i: number) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(gain);
      const s = ctx.currentTime + i * 0.065;
      o.start(s);
      o.stop(s + 0.12);
    });
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);
    window.setTimeout(() => void ctx.close(), 600);
  } catch {}
}

function PortalIcon({ kind }: { kind: "student" | "teacher" }) {
  return kind === "student" ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m3 9 9-5 9 5-9 5z" />
      <path d="M7 12v4c2.8 2.1 7.2 2.1 10 0v-4" />
      <path d="M21 9v6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="7" r="3" />
      <path d="M5 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3" />
      <path d="M9 17h6" />
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const prefersReduced = useReducedMotion();
  const enter = (path: string) => {
    playEntryTone();
    window.setTimeout(() => router.push(path), 90);
  };

  const heroImageVariants = {
    initial: { opacity: 0.0, scale: 0.98, y: 12 },
    enter: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.7, ease: [0.2,0.8,0.2,1] as any } },
    float: (i: number) => ({ y: [0, -8, 0], transition: { duration: 6 + i, repeat: Infinity } })
  } as any;

  const cardHover = { scale: 1.02, translateY: -6, boxShadow: "0 10px 30px rgba(0,0,0,0.10)", transition: { duration: 0.22 } };

  return (
    <main className={styles.eduHome} dir="rtl">
      <header className={styles.navBar}>
        <div className={styles.brand}>
          <motion.div layoutId="brand-logo" className={styles.logo} aria-hidden="true" whileHover={{ scale: 1.04 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>ح</motion.div>
          <div>
            <strong>أستاذ لحوني</strong>
            <small>بوابة المعلم</small>
          </div>
        </div>
        <nav className={styles.navActions}>
          <motion.button onClick={() => enter('/teacher')} className={styles.ctaPrimary} whileTap={{ scale: 0.98 }} aria-label="دخول المعلم">دخول المعلم</motion.button>
          <motion.button onClick={() => enter('/student')} className={styles.ctaGhost} whileTap={{ scale: 0.98 }} aria-label="دخول الطالب">دخول الطالب</motion.button>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <div className={styles.badge}><motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>منصة تعليمية رقمية</motion.span></div>
          <h1>
            بوابة <motion.span layoutId="brand-name">أستاذ لحوني</motion.span>
          </h1>
          <p>
            مكان واحد للدرجات، الحضور، التقارير والملاحظات. تجربة سريعة وآمنة للمعلمين والطلاب تركز على الأداء والأثر التعليمي.
          </p>
          <div className={styles.points}>
            <motion.span whileHover={{ scale: prefersReduced ? 1 : 1.02 }} transition={{ duration: 0.18 }}>متابعة فورية</motion.span>
            <motion.span whileHover={{ scale: prefersReduced ? 1 : 1.02 }} transition={{ duration: 0.18 }}>تقارير ذكية</motion.span>
            <motion.span whileHover={{ scale: prefersReduced ? 1 : 1.02 }} transition={{ duration: 0.18 }}>دخول آمن</motion.span>
          </div>
        </div>

        <div className={styles.visual}>
          <motion.div className={styles.ringOne} aria-hidden="true" initial={{ scale: 0.95, opacity: 0.05 }} animate={{ scale: 1, opacity: 0.12 }} transition={{ duration: 1.2 }} />
          <motion.div className={styles.ringTwo} aria-hidden="true" initial={{ scale: 0.98, opacity: 0.03 }} animate={{ scale: 1.04, opacity: 0.08 }} transition={{ duration: 1.6 }} />

          <motion.div initial="initial" animate="enter" className={styles.heroImageWrap}>
            <motion.div variants={heroImageVariants} initial="initial" animate="enter" style={{ willChange: "transform, opacity" }}>
              <Image src="/students-learning.svg" alt="طلاب يتعلمون" width={520} height={420} priority={false} />
            </motion.div>
          </motion.div>

          <motion.div className={`${styles.floating} ${styles.f1}`} custom={0} variants={heroImageVariants} animate={prefersReduced ? undefined : "float"} style={{ willChange: "transform" }}>
            📊 <b>تقدم مستمر</b>
          </motion.div>

          <motion.div className={`${styles.floating} ${styles.f2}`} custom={1} variants={heroImageVariants} animate={prefersReduced ? undefined : "float"} style={{ willChange: "transform" }}>
            ✓ <b>رصد دقيق</b>
          </motion.div>
        </div>
      </section>

      <section className={styles.access}>
        <motion.button className={`${styles.portalCard} ${styles.student}`} onClick={() => enter('/student')} whileHover={prefersReduced ? undefined : cardHover} whileTap={{ scale: 0.995 }} aria-label="بوابة المتابعة للطالب">
          <span className={styles.icon}><PortalIcon kind="student" /></span>
          <div>
            <small>للطالب وولي الأمر</small>
            <strong>بوابة المتابعة</strong>
            <p>الدرجات، الحضور، التنبيهات ومستوى الإتقان.</p>
          </div>
          <b className={styles.arrow}>←</b>
        </motion.button>

        <motion.button className={`${styles.portalCard} ${styles.teacher}`} onClick={() => enter('/teacher')} whileHover={prefersReduced ? undefined : cardHover} whileTap={{ scale: 0.995 }} aria-label="لوحة إدارة المعلم">
          <span className={styles.icon}><PortalIcon kind="teacher" /></span>
          <div>
            <small>للمعلم</small>
            <strong>لوحة إدارة المادة</strong>
            <p>الرصد، الطلاب، التقارير، البحث والمتابعة.</p>
          </div>
          <b className={styles.arrow}>←</b>
        </motion.button>

        <a className={styles.qrCard} href="/student" aria-label="فتح بوابة الطالب">
          <div className={styles.qr}><QRCodeSVG value={studentUrl} size={92} includeMargin /></div>
          <div>
            <small>دخول سريع</small>
            <strong>امسح الرمز لفتح بوابة الطالب</strong>
            <p>يفتح صفحة الهوية وكود الطالب مباشرة.</p>
          </div>
        </a>
      </section>

      <footer className={styles.footer}>
        <span>بوابة أستاذ لحوني التعليمية</span>
        <small>تعليم أوضح • متابعة أدق • أثر أكبر</small>
      </footer>
    </main>
  );
}
