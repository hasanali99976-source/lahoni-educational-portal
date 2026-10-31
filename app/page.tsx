import Link from "next/link";

const destinations = [
  { id: "01", title: "بوابة أستاذ لحوني التعليمية", tag: "البوابة الحالية", detail: "مساحة الإدارة والمعلم والطالب وولي الأمر، بكامل خدماتها وسجلاتها الحالية.", href: "/portal", className: "teacher", icon: "✦", button: "الدخول إلى البوابة" },
  { id: "02", title: "بوابة المدرسة", tag: "المشروع الجديد", detail: "مساحة مستقلة للخدمات المدرسية، نعمل على تجهيزها وتطويرها تدريجيًا.", href: "/school", className: "school", icon: "▦", button: "استعراض بوابة المدرسة" },
];
export default function HomePage() {
 return <main className="hub" dir="rtl"><style>{`
 .hub,.hub *{box-sizing:border-box}.hub{min-height:100dvh;position:relative;isolation:isolate;overflow:hidden;font-family:"Tajawal",Tahoma,sans-serif;color:#173c59;background:linear-gradient(125deg,rgba(239,250,255,.92),rgba(251,246,255,.84) 48%,rgba(234,249,246,.9)),url("/lahooni-home-new.png.png") center/cover no-repeat}
 .hub:before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(circle at 12% 10%,#a7e2fa77,transparent 35%),radial-gradient(circle at 90% 70%,#d7b6f655,transparent 40%);pointer-events:none}
 .hub-shell{width:min(1190px,100%);padding:24px clamp(18px,4vw,48px) 36px;margin:auto}
 .hub-header{display:flex;justify-content:space-between;align-items:center;gap:16px}
 .hub-logo{display:flex;align-items:center;gap:13px;padding:10px 16px;border:1px solid #ffffffc9;border-radius:21px;background:#ffffffc9;box-shadow:0 12px 35px #417c9a19}
 .hub-logo img{width:57px;height:57px;border-radius:15px;object-fit:cover}.hub-logo strong{font-size:23px;font-weight:900;display:block}.hub-logo small{color:#638198;font-weight:700}
 .hub-badge{border-radius:99px;background:#ffffffc9;padding:12px 18px;color:#426f86;font-weight:800;border:1px solid #fff}
 .hub-intro{text-align:center;padding:58px 0 35px}.hub-kicker{display:inline-block;padding:9px 23px;border-radius:99px;background:#ffffffd9;border:1px solid #fff;color:#287e99;font-weight:900;box-shadow:0 8px 25px #4885a21c}
 .hub-intro h1{font-size:clamp(40px,6vw,74px);margin:16px 0 8px;font-weight:900;letter-spacing:-1px;color:#184c73}.hub-intro h1 span{color:#885bb2}.hub-intro p{font-size:clamp(15px,1.8vw,19px);line-height:1.9;color:#54758c;max-width:680px;margin:0 auto}
 .hub-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
 .hub-card{position:relative;display:flex;flex-direction:column;min-height:340px;padding:30px;border-radius:29px;text-decoration:none;overflow:hidden;transition:transform .2s,box-shadow .2s;border:2px solid #fff;box-shadow:0 18px 45px #2c69842b;color:#194966}
 .hub-card.teacher{background:linear-gradient(135deg,#e8f9ff,#b8e9fa 75%,#9cd8f5)}.hub-card.school{background:linear-gradient(135deg,#f5efff,#e0cdfa 75%,#d0b9f3)}
 .hub-card:before{content:"";position:absolute;left:-55px;top:-75px;width:270px;height:270px;border-radius:50%;background:#ffffff57;pointer-events:none}
 .hub-card:hover,.hub-card:focus-visible{transform:translateY(-6px);box-shadow:0 24px 50px #2c698444;outline:3px solid #ffffff}
 .hub-card-top{display:flex;justify-content:space-between;align-items:center;position:relative}.hub-icon{width:74px;height:74px;display:grid;place-items:center;border-radius:22px;background:#ffffffb8;font-size:40px;color:#27799b;box-shadow:0 9px 22px #4885a21a}.school .hub-icon{color:#8258b1}.hub-index{font-weight:900;font-size:27px;color:#ffffff;opacity:.9}
 .hub-card-content{margin-top:auto;position:relative}.hub-tag{display:inline-block;font-weight:900;color:#337e9c;font-size:14px}.school .hub-tag{color:#8657af}
 .hub-card h2{font-size:clamp(25px,3vw,34px);margin:8px 0;font-weight:900;line-height:1.35}.hub-card p{font-size:15px;line-height:1.8;margin:0 0 18px;max-width:430px;color:#46667c}
 .hub-button{display:flex;align-items:center;justify-content:space-between;gap:15px;background:#ffffffdd;border-radius:14px;padding:14px 18px;font-weight:900;font-size:15px}.hub-button b{font-size:25px;line-height:1}
 .hub-note{text-align:center;margin:30px auto 0;color:#5c7c91;font-size:13px;font-weight:700}.hub-footer{text-align:center;margin-top:35px;font-size:12px;color:#6b879a}
 @media(max-width:720px){.hub-shell{padding:15px 14px 25px}.hub-logo img{width:44px;height:44px}.hub-logo strong{font-size:17px}.hub-logo small{font-size:10px}.hub-badge{font-size:10px;padding:9px}.hub-intro{padding:44px 0 25px}.hub-grid{grid-template-columns:1fr;gap:16px}.hub-card{min-height:280px;padding:23px}.hub-card h2{font-size:26px}.hub-card p{font-size:13px}}
 @media(prefers-reduced-motion:reduce){.hub-card{transition:none}}
 `}</style>
 <div className="hub-shell"><header className="hub-header"><div className="hub-logo"><img src="/icons/lahooni-identity-320.jpg" alt="هوية لحوني"/><div><strong>لحوني التعليمية</strong><small>منظومة البوابات التعليمية</small></div></div><span className="hub-badge">تعليم • ابتكار • تطوير</span></header>
 <section className="hub-intro"><span className="hub-kicker">مرحبًا بك في منظومة لحوني</span><h1>لحوني <span>التعليمية</span></h1><p>منصة واحدة تجمع بوابات تعليمية متخصصة، لتجربة أكثر تنظيمًا وتكاملًا. اختر البوابة التي تريد الدخول إليها.</p></section>
 <nav className="hub-grid" aria-label="اختيار البوابة">{destinations.map(d=><Link href={d.href} key={d.id} className={`hub-card ${d.className}`}><div className="hub-card-top"><span className="hub-icon" aria-hidden="true">{d.icon}</span><span className="hub-index">{d.id}</span></div><div className="hub-card-content"><span className="hub-tag">{d.tag}</span><h2>{d.title}</h2><p>{d.detail}</p><span className="hub-button">{d.button}<b aria-hidden="true">←</b></span></div></Link>)}</nav>
 <p className="hub-note">البوابة الحالية محفوظة بخدماتها كما هي، والمنظومة مهيأة لإضافة بوابات أخرى مستقبلًا دون إظهارها الآن.</p><footer className="hub-footer">لحوني التعليمية © 2026</footer></div></main>;
}