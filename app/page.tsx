"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import styles from "./home.module.css";

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
  const enter = (path: string) => {
    playEntryTone();
    window.setTimeout(() => router.push(path), 90);
  };

  return (
    <main className={styles.eduHome} dir="rtl">
      <header className={styles.navBar}>
        <div className={styles.brand}>
          <div className={styles.logo}>ح</div>
          <div>
            <strong>أستاذ لحوني</strong>
            <small>بوابة المعلم</small>
          </div>
        </div>
        <nav className={styles.navActions}>
          <button onClick={() => enter('/teacher')} className={styles.ctaPrimary}>دخول المعلم</button>
          <button onClick={() => enter('/student')} className={styles.ctaGhost}>دخول الطالب</button>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <div className={styles.badge}>منصة تعليمية رقمية</div>
          <h1>
            بوابة <span>أستاذ لحوني</span>
          </h1>
          <p>
            مكان واحد للدرجات، الحضور، التقارير والملاحظات. تجربة سريعة وآمنة للمعلمين والطلاب تركز على الأداء والأثر التعليمي.
          </p>
          <div className={styles.points}>
            <span>متابعة فورية</span>
            <span>تقارير ذكية</span>
            <span>دخول آمن</span>
          </div>
        </div>

        <div className={styles.visual}>
          <div className={styles.ringOne} />
          <div className={styles.ringTwo} />
          <Image src="/students-learning.svg" alt="طلاب يتعلمون" width={520} height={420} priority={false} />
          <div className={`${styles.floating} ${styles.f1}`}>📊 <b>تقدم مستمر</b></div>
          <div className={`${styles.floating} ${styles.f2}`}>✓ <b>رصد دقيق</b></div>
        </div>
      </section>

      <section className={styles.access}>
        <button className={`${styles.portalCard} ${styles.student}`} onClick={() => enter('/student')}>
          <span className={styles.icon}><PortalIcon kind="student" /></span>
          <div>
            <small>للطالب وولي الأمر</small>
            <strong>بوابة المتابعة</strong>
            <p>الدرجات، الحضور، التنبيهات ومستوى الإتقان.</p>
          </div>
          <b className={styles.arrow}>←</b>
        </button>

        <button className={`${styles.portalCard} ${styles.teacher}`} onClick={() => enter('/teacher')}>
          <span className={styles.icon}><PortalIcon kind="teacher" /></span>
          <div>
            <small>للمعلم</small>
            <strong>لوحة إدارة المادة</strong>
            <p>الرصد، الطلاب، التقارير، البحث والمتابعة.</p>
          </div>
          <b className={styles.arrow}>←</b>
        </button>

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
