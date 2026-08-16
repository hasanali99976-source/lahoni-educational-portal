"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

type LoginMode = "teacher" | "student";

const teacherImage = "https://shimmering-rolypoly-0ebda2.netlify.app/portal.png";
const studentUrl = "https://tahdheeb-history.vercel.app/student";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("student");

  function submit() {
    router.push(mode === "teacher" ? "/teacher" : "/student");
  }

  return (
    <main className="portal-home" dir="rtl">
      <section className="portal-shell">
        <div className="portal-header">
          <div className="brand-mark">ح</div>
          <div>
            <h1>بوابة أستاذ لحوني التعليمية</h1>
            <p>نظام تعليمي لمتابعة الطلاب والدرجات والإتقان</p>
          </div>
        </div>
        <div className="portal-content">
          <div className="portal-visual">
            <div className="portrait-frame"><img src={teacherImage} alt="صورة الأستاذ حسن علي الطويل" /></div>
            <div className="visual-caption"><strong>الأستاذ حسن علي الطويل</strong><span>التعليم • المتابعة • الأثر</span></div>
            <div className="learning-shapes" aria-hidden="true"><span>📚</span><span>✏️</span><span>🎓</span></div>
          </div>
          <div className="portal-login">
            <div className="welcome"><span className="eyebrow">أهلًا وسهلًا</span><h2>ابدأ من هنا</h2><p>اختر نوع الدخول للوصول إلى البوابة.</p></div>
            <div className="portal-tabs">
              <button type="button" className={mode === "student" ? "active" : ""} onClick={() => setMode("student")}><span className="tab-icon">👨‍🎓</span><span>بوابة الطالب / ولي الأمر</span></button>
              <button type="button" className={mode === "teacher" ? "active" : ""} onClick={() => setMode("teacher")}><span className="tab-icon">👨‍🏫</span><span>بوابة المعلم</span></button>
            </div>
            {mode === "teacher" ? <div><p className="hint">سيتم نقلك إلى صفحة دخول المعلم الآمنة.</p><button type="button" className="portal-submit" onClick={submit}>دخول بوابة المعلم</button></div> : <div><p className="hint">للطالب وولي الأمر: اضغط للدخول، ثم أدخل رقم الهوية الوطنية وكود الطالب.</p><button type="button" className="portal-submit" onClick={submit}>دخول بوابة الطالب</button></div>}
            <div className="portal-footer"><div><span>🔒</span><small>بيانات آمنة</small></div><div><span>📱</span><small>مصمم للجوال</small></div><div><span>🎯</span><small>متابعة تعليمية</small></div></div>
            <a className="quick-student" href="/student" aria-label="الدخول السريع للطالب"><QRCodeSVG value={studentUrl} size={64} includeMargin /><span><strong>دخول سريع للطالب</strong><small>امسح الرمز بالكاميرا</small></span></a>
          </div>
        </div>
      </section>
      <style jsx global>{`
        .portal-home{min-height:100vh;padding:30px;display:grid;place-items:center;background:linear-gradient(135deg,#f4fafb,#eef6f7 48%,#f9fcfd);font-family:Tahoma,Arial,sans-serif;color:#173f4c}.portal-shell{width:min(1080px,100%);background:#fff;border:1px solid #dcebed;border-radius:30px;overflow:hidden;box-shadow:0 24px 70px rgba(25,78,91,.12)}.portal-header{display:flex;align-items:center;gap:14px;padding:25px 32px;border-bottom:1px solid #e6f0f2}.brand-mark{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:#e6f5f6;color:#147181;font-size:24px;font-weight:900}.portal-header h1{margin:0 0 5px;font-size:25px;color:#123f4d}.portal-header p{margin:0;color:#708891;font-size:13px}.portal-content{display:grid;grid-template-columns:.92fr 1.08fr;min-height:610px}.portal-visual{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:42px 35px;background:linear-gradient(180deg,#edf8f8,#e5f3f5);overflow:hidden}.portrait-frame{width:min(330px,78%);aspect-ratio:3/4;border-radius:170px 170px 35px 35px;overflow:hidden;background:#d9edf0;border:9px solid rgba(255,255,255,.82);box-shadow:0 22px 45px rgba(35,101,113,.18)}.portrait-frame img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}.visual-caption{margin-top:22px;text-align:center;display:flex;flex-direction:column;gap:7px}.visual-caption strong{font-size:20px;color:#174d5b}.visual-caption span{font-size:13px;color:#6c8991}.learning-shapes{position:absolute;inset:0;pointer-events:none}.learning-shapes span{position:absolute;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.82);box-shadow:0 10px 25px rgba(40,100,110,.08);font-size:20px}.learning-shapes span:nth-child(1){top:60px;right:45px}.learning-shapes span:nth-child(2){bottom:100px;left:40px}.learning-shapes span:nth-child(3){top:145px;left:35px}.portal-login{padding:52px 55px;display:flex;flex-direction:column;justify-content:center}.welcome .eyebrow{display:inline-block;padding:7px 12px;border-radius:999px;background:#e8f6f7;color:#157180;font-size:12px;font-weight:800}.welcome h2{margin:14px 0 7px;font-size:34px;color:#143f4d}.welcome p{margin:0 0 27px;color:#718790;font-size:14px}.portal-tabs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:22px}.portal-tabs button{min-height:76px;border:1px solid #dce9ec;background:#fbfdfd;border-radius:17px;padding:12px 10px;color:#496b76;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;flex-direction:column;transition:.2s}.portal-tabs button:hover{border-color:#b9dce0;transform:translateY(-1px)}.portal-tabs button.active{background:#eaf7f8;border-color:#2a9aaa;color:#126878;box-shadow:0 8px 20px rgba(31,139,153,.1)}.tab-icon{font-size:21px;line-height:1}.hint{margin:0;color:#6f858d;font-size:14px;line-height:1.9}.portal-submit{width:100%;height:54px;margin-top:18px;border:0;border-radius:14px;background:#167789;color:#fff;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 10px 24px rgba(22,119,137,.18)}.portal-footer{display:flex;justify-content:space-between;gap:8px;margin-top:25px;padding-top:18px;border-top:1px solid #e7f0f2;color:#789098}.portal-footer div{display:flex;align-items:center;gap:6px;font-size:12px}.portal-footer span{font-size:15px}.portal-footer small{font-size:11px}.quick-student{margin-top:20px;padding:10px;border:1px solid #e3eef0;border-radius:14px;background:#f9fcfc;display:flex;align-items:center;gap:12px;text-decoration:none;color:#205766}.quick-student span{display:flex;flex-direction:column;gap:4px}.quick-student strong{font-size:12px}.quick-student small{font-size:10px;color:#7a9097}@media(max-width:800px){.portal-home{padding:15px}.portal-content{grid-template-columns:1fr}.portal-visual{min-height:480px;padding:35px 20px}.portal-login{padding:35px 25px}.portal-header{padding:20px}.portal-header h1{font-size:21px}.portrait-frame{width:250px}}@media(max-width:500px){.portal-shell{border-radius:22px}.portal-header{align-items:flex-start}.brand-mark{width:45px;height:45px}.portal-header h1{font-size:18px;line-height:1.5}.portal-header p{font-size:11px}.portal-visual{min-height:390px}.portrait-frame{width:210px}.learning-shapes span{transform:scale(.82)}.portal-login{padding:28px 18px}.welcome h2{font-size:28px}.portal-tabs{grid-template-columns:1fr}.portal-footer small{font-size:10px}}
      `}</style>
    </main>
  );
}
