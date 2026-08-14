"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  TeacherIcon,
  IdCardIcon,
  ArrowIcon,
  LockIcon,
  ShieldIcon,
  PhoneIcon,
  UsersIcon,
} from "../components/icons";

const studentUrl = "https://tahdheeb-history.netlify.app/student";
type LoginMode = "teacher" | "student";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function selectMode(next: LoginMode) {
    setMode((current) => (current === next ? null : next));
    setValue("");
    setError("");
  }

  function submit() {
    setError("");
    if (mode === "teacher") {
      if (value === "1415") router.push("/teacher/dashboard");
      else setError("رمز دخول المعلم غير صحيح");
      return;
    }
    const nationalId = value.replace(/\D/g, "");
    if (!/^\d{10}$/.test(nationalId)) {
      setError("أدخل رقم هوية صحيحًا مكوّنًا من 10 أرقام");
      return;
    }
    router.push(`/student?nationalId=${nationalId}`);
  }

  return (
    <main className="home" dir="rtl">
      <div className="home-inner">
        <div className="home-topbar">
          <div className="brand">
            <div className="brand-logo">ت</div>
            <div className="brand-name">
              <strong>بوابة التهذيب</strong>
              <small>نظام متابعة مادة التاريخ</small>
            </div>
          </div>
          <div className="home-school">
            <UsersIcon style={{ width: 16, height: 16 }} />
            مدرسة التهذيب الثانوية
          </div>
        </div>

        <div className="home-grid">
          {/* Hero / photo */}
          <section className="hero">
            <span className="hero-eyebrow">النسخة الجديدة — بيئة الموهبة والإبداع</span>
            <h1 className="text-balance">بوابة التهذيب التعليمية لمادة التاريخ</h1>
            <p>
              متابعة الحضور والدرجات والتقارير في مكان واحد منظم وآمن — تجربة سلسة للمعلم
              والطالب وولي الأمر.
            </p>

            <div className="hero-stats">
              <div>
                <strong>٥</strong>
                <span>وحدات دراسية</span>
              </div>
              <div>
                <strong>٢ث</strong>
                <span>الصف الثاني الثانوي</span>
              </div>
              <div>
                <strong>٢٤/٧</strong>
                <span>وصول دائم</span>
              </div>
            </div>

            <div className="hero-photo">
              <img src="/portal.png" alt="الأستاذ حسن علي الطويل معلم مادة التاريخ" />
              <div className="hero-teacher-tag">
                <span className="avatar-dot">ح</span>
                <div>
                  <b>الأستاذ حسن علي الطويل</b>
                  <span>معلم التاريخ</span>
                </div>
              </div>
            </div>
          </section>

          {/* Login */}
          <section className="login-side">
            <div className="login-heading">
              <span className="eyebrow">أهلًا وسهلًا بكم</span>
              <h2 style={{ marginTop: 12 }}>اختر نوع الدخول</h2>
              <p>حدّد بطاقتك ثم أدخل بياناتك للوصول إلى البوابة.</p>
            </div>

            <div className="login-cards">
              {/* Teacher */}
              <div
                className={`login-card${mode === "teacher" ? " active" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => selectMode("teacher")}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && selectMode("teacher")}
              >
                <div className="login-card-top">
                  <div className="login-card-icon teal">
                    <TeacherIcon />
                  </div>
                  <div>
                    <h3>دخول المعلم</h3>
                    <span>الوصول إلى لوحة التحكم الكاملة</span>
                  </div>
                  <ArrowIcon className="arrow" />
                </div>

                {mode === "teacher" && (
                  <div className="login-form" onClick={(e) => e.stopPropagation()}>
                    <div className="input-with-icon">
                      <LockIcon />
                      <input
                        className="field"
                        type="password"
                        inputMode="numeric"
                        value={value}
                        autoFocus
                        onChange={(e) => {
                          setValue(e.target.value.replace(/\D/g, "").slice(0, 8));
                          setError("");
                        }}
                        onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && submit()}
                        placeholder="أدخل رمز المعلم"
                      />
                    </div>
                    {error && <p className="error">{error}</p>}
                    <button type="button" className="btn primary block" onClick={submit}>
                      دخول إلى لوحة المعلم
                    </button>
                  </div>
                )}
              </div>

              {/* Student */}
              <div
                className={`login-card${mode === "student" ? " active" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => selectMode("student")}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && selectMode("student")}
              >
                <div className="login-card-top">
                  <div className="login-card-icon blue">
                    <IdCardIcon />
                  </div>
                  <div>
                    <h3>دخول الطالب / ولي الأمر</h3>
                    <span>الاطلاع على الحضور والدرجات</span>
                  </div>
                  <ArrowIcon className="arrow" />
                </div>

                {mode === "student" && (
                  <div className="login-form" onClick={(e) => e.stopPropagation()}>
                    <div className="input-with-icon">
                      <IdCardIcon />
                      <input
                        className="field"
                        type="text"
                        inputMode="numeric"
                        value={value}
                        autoFocus
                        onChange={(e) => {
                          setValue(e.target.value.replace(/\D/g, "").slice(0, 10));
                          setError("");
                        }}
                        onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && submit()}
                        placeholder="رقم الهوية الوطنية (10 أرقام)"
                      />
                    </div>
                    {error && <p className="error">{error}</p>}
                    <button type="button" className="btn blue block" onClick={submit}>
                      عرض بيانات الطالب
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* QR */}
            <div className="qr-card">
              <div className="qr-box">
                <QRCodeSVG value={studentUrl} size={92} />
              </div>
              <div>
                <b>الدخول السريع للطالب</b>
                <span>امسح الرمز بكاميرا الجوال للوصول المباشر إلى بوابة الطالب.</span>
              </div>
            </div>

            <div className="home-notes">
              <span>
                <ShieldIcon />
                بيانات آمنة وسرية
              </span>
              <span>
                <PhoneIcon />
                متوافق مع الجوال
              </span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
