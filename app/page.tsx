import Link from "next/link";

const features = [
  {icon:"◈",title:"مساعد ذكي",detail:"تحليل وخطط تعليمية",tone:"gold"},
  {icon:"▣",title:"شهادات الطلاب",detail:"تصميم وإصدار",tone:"blue"},
  {icon:"◇",title:"سجل الانضباط",detail:"ملاحظات وإحالات",tone:"pink"},
  {icon:"▤",title:"متابعة التحصيل",detail:"نتائج وإتقان",tone:"teal"},
  {icon:"♧",title:"إدارة الفصول",detail:"طلاب ومعلمون",tone:"orange"},
  {icon:"▥",title:"تقارير شاملة",detail:"إحصاءات وتحليلات",tone:"purple"},
];
export default function HomePage(){
return <main className="lahoni-home" dir="rtl">
<style>{`
.lahoni-home,.lahoni-home *{box-sizing:border-box}.lahoni-home{font-family:"Tajawal",Tahoma,Arial,sans-serif;min-height:100dvh;overflow:hidden;color:#123c76;background:radial-gradient(ellipse at 50% 3%,#fff 0%,transparent 56%),radial-gradient(ellipse at 5% 45%,#c5e9ff 0%,transparent 40%),radial-gradient(ellipse at 95% 50%,#ead7ff 0%,transparent 40%),linear-gradient(140deg,#edf6ff,#f8f4ff 65%,#e5f8ff)}
.lahoni-home:before{content:"";position:absolute;inset:0 0 auto;height:640px;pointer-events:none;opacity:.36;background-image:radial-gradient(#87b4e8 1px,transparent 1px);background-size:26px 26px;mask-image:linear-gradient(#000,transparent)}
.lahoni-wrap{position:relative;width:min(1510px,96%);margin:auto;padding:16px 0 25px}.lahoni-nav{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 24px;border:1px solid white;border-radius:30px;background:#ffffffc9;box-shadow:0 12px 36px #4676b51b;backdrop-filter:blur(16px)}.lahoni-brand{display:flex;align-items:center;gap:12px}.lahoni-mark{display:grid;place-items:center;width:57px;height:57px;border-radius:20px;background:linear-gradient(135deg,#1b6ae8,#7835e9);font-size:30px;color:white}.lahoni-brand strong{display:block;font-size:24px;font-weight:900;color:#183d89}.lahoni-brand small{font-size:12px;color:#6480a2}.lahoni-menu{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.lahoni-menu a,.lahoni-login{padding:13px 17px;border-radius:17px;text-decoration:none;color:#194d98;font-weight:800;font-size:14px;transition:transform .25s,background .25s}.lahoni-menu a:hover{background:#e5efff;transform:translateY(-2px)}.lahoni-menu a:first-child,.lahoni-login{background:linear-gradient(115deg,#7135e9,#0877e8);color:#fff;box-shadow:0 7px 18px #4479dc4a}.lahoni-login{white-space:nowrap}
.lahoni-hero{text-align:center;position:relative;padding:35px 0 20px;min-height:292px}.lahoni-pill{display:inline-block;background:#ffffffd9;border:1px solid #fff;padding:9px 24px;border-radius:40px;font-weight:900;color:#1971c9;box-shadow:0 8px 20px #6897d31c}.lahoni-hero h1{font-size:clamp(44px,6vw,83px);font-weight:900;letter-spacing:-2px;line-height:1.3;margin:8px 0 4px;background:linear-gradient(90deg,#0a64c4,#5720c5,#135baf);background-clip:text;color:transparent}.lahoni-hero p{max-width:690px;margin:0 auto;color:#426a9c;font-size:clamp(15px,1.6vw,19px);line-height:1.8}.lahoni-benefits{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:17px}.lahoni-benefits span{background:#ffffffb9;border:1px solid #fff;padding:8px 15px;border-radius:40px;font-weight:800;font-size:13px;color:#345aa3}
.lahoni-person{position:absolute;top:58px;width:155px;height:182px;border:2px solid #fff;border-radius:38px;background:linear-gradient(155deg,#d4edff,#fff9ff);box-shadow:0 18px 35px #597bc32b;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;animation:float 5s ease-in-out infinite}.lahoni-person.teacher{right:0}.lahoni-person.student{left:0;animation-delay:-2s;background:linear-gradient(155deg,#e8dcff,#fff)}.lahoni-person .avatar{font-size:79px;line-height:1.2}.lahoni-person b{font-size:15px;color:#2256a1}
.lahoni-portals{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:1160px;margin:5px auto 0}.lahoni-card{position:relative;display:flex;flex-direction:column;min-height:278px;padding:28px;border:2px solid #fff;border-radius:30px;box-shadow:0 19px 35px #4a7cb82a;text-decoration:none;overflow:hidden;color:#15457f;transition:transform .28s,box-shadow .28s}.lahoni-card:hover,.lahoni-card:focus-visible{transform:translateY(-7px);box-shadow:0 28px 45px #4a7cb83a;outline:2px solid #9cb9ff}.lahoni-card.teacher{background:linear-gradient(120deg,#c2ecff,#e8f8ff)}.lahoni-card.school{background:linear-gradient(120deg,#e0c7ff,#f4ebff)}.lahoni-card:before{content:"";position:absolute;width:220px;height:220px;border-radius:50%;left:-65px;top:-80px;background:#fff6}.lahoni-card-head{display:flex;justify-content:space-between;align-items:center;position:relative}.lahoni-card-icon{display:grid;place-items:center;width:65px;height:65px;border-radius:19px;background:#ffffffa8;font-size:38px}.lahoni-number{font-weight:900;font-size:24px;color:#3a78bd88}.lahoni-card h2{position:relative;font-size:clamp(23px,2.5vw,33px);font-weight:900;margin:10px 0 5px}.lahoni-card p{position:relative;color:#476b94;font-size:14px;line-height:1.8;margin:0 0 20px;max-width:430px}.lahoni-card-action{margin-top:auto;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(105deg,#0069d9,#1b85f5);border-radius:16px;color:white;padding:13px 20px;font-weight:900;box-shadow:0 7px 15px #2a75db3b}.school .lahoni-card-action{background:linear-gradient(105deg,#6822d6,#8c43ec)}
.lahoni-features{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-top:22px}.lahoni-feature{border:1px solid #fff;background:#ffffffc9;border-radius:22px;padding:16px 8px;text-align:center;box-shadow:0 8px 24px #5679b51a;transition:transform .2s}.lahoni-feature:hover{transform:translateY(-4px)}.lahoni-feature i{display:grid;place-items:center;width:44px;height:44px;margin:0 auto 8px;border-radius:14px;font-size:25px;font-style:normal;background:#e5d7ff;color:#6935d3}.lahoni-feature.blue i{background:#d4e8ff;color:#1672e7}.lahoni-feature.pink i{background:#ffe0f0;color:#df368d}.lahoni-feature.teal i{background:#d2f6f0;color:#008c86}.lahoni-feature.orange i{background:#ffead6;color:#e77812}.lahoni-feature.gold i{background:#fff0c3;color:#c99100}.lahoni-feature strong{display:block;font-size:14px}.lahoni-feature small{display:block;font-size:11px;margin-top:4px;color:#6381a6}.lahoni-footer{text-align:center;color:#6480a3;font-size:12px;margin-top:20px}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}@media(max-width:1050px){.lahoni-person{display:none}.lahoni-nav{flex-wrap:wrap}.lahoni-menu{order:3;width:100%;justify-content:center}.lahoni-hero{min-height:auto;padding:38px 0}.lahoni-features{grid-template-columns:repeat(3,1fr)}}@media(max-width:650px){.lahoni-wrap{width:94%}.lahoni-nav{padding:12px;gap:8px;border-radius:20px}.lahoni-brand strong{font-size:17px}.lahoni-brand small{font-size:10px}.lahoni-mark{width:42px;height:42px;font-size:24px}.lahoni-login{font-size:12px;padding:11px}.lahoni-menu{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start}.lahoni-menu a{white-space:nowrap;padding:9px 11px;font-size:12px}.lahoni-hero h1{letter-spacing:0}.lahoni-portals{grid-template-columns:1fr;gap:15px}.lahoni-card{min-height:255px;padding:21px}.lahoni-features{grid-template-columns:repeat(2,1fr)}}@media(prefers-reduced-motion:reduce){.lahoni-person{animation:none}.lahoni-card,.lahoni-feature,.lahoni-menu a{transition:none}}

/* Enhanced visual presentation: CSS only, no additional data reads */
.lahoni-home{background:radial-gradient(ellipse at 50% 4%,#ffffffd9 0%,transparent 55%),radial-gradient(ellipse at 0% 45%,#8fcaff99 0%,transparent 46%),radial-gradient(ellipse at 100% 52%,#d2a8ff99 0%,transparent 46%),linear-gradient(125deg,#d6e9ff,#e8e1ff 60%,#d6f0ff)}
.lahoni-nav{background:#ffffffdd;box-shadow:0 13px 38px #3e61a535;border-radius:34px}
.lahoni-hero h1{text-shadow:0 6px 18px #8361d526}
.lahoni-person{width:180px;height:208px;top:38px;border-radius:34px;box-shadow:0 18px 50px #466bc73d;background:linear-gradient(145deg,#e2efff,#f4e7ff)}
.lahoni-person .avatar{font-size:94px}
.lahoni-card{min-height:300px;border-radius:34px;box-shadow:0 22px 45px #5273c53d;backdrop-filter:blur(10px)}
.lahoni-card.teacher{background:linear-gradient(135deg,#a6d9ff,#e3f7ff 72%,#e9f9ff)}
.lahoni-card.school{background:linear-gradient(135deg,#d4b4ff,#f2e8ff 72%,#f7efff)}
.lahoni-card-icon{box-shadow:0 8px 22px #5a69bd30}
.lahoni-card-action{transition:filter .25s,transform .25s}
.lahoni-card:hover .lahoni-card-action{filter:brightness(1.08);transform:translateY(-2px)}
.lahoni-feature{border-radius:25px;background:#fffffff0;box-shadow:0 12px 28px #4568ac26}
.lahoni-feature i{box-shadow:0 6px 14px #4568ac20}
@media(max-width:1050px){.lahoni-person{display:none}}
@media(prefers-reduced-motion:reduce){.lahoni-card-action{transition:none}}

/* One artwork, one interface. Clickable transparent overlays follow the visible buttons. */
.lahoni-home{background:linear-gradient(145deg,#e5efff,#f0eaff);min-height:100dvh}
.lahoni-home:before{display:none}
.lahoni-wrap{width:min(1776px,100%);padding:0;margin:0 auto}
.lahoni-hero{position:relative;display:block;width:100%;height:auto;min-height:0;aspect-ratio:1776/864;padding:0;margin:0;border:0;border-radius:0;background:url("/lahoni-education-.png") center top/100% 100% no-repeat;box-shadow:none;overflow:hidden}
.lahoni-hero:before,.lahoni-hero:after{display:none}
.art-hotspot{position:absolute;z-index:3;display:block;border-radius:28px;cursor:pointer;transition:background .2s,box-shadow .2s}
.art-hotspot:hover{background:#ffffff1c;box-shadow:inset 0 0 0 3px #ffffff99}
.art-hotspot:focus-visible{outline:4px solid #f8b800;outline-offset:2px;background:#ffffff33}
.art-login{left:6.5%;top:1.6%;width:13%;height:7.4%}
.art-teacher{left:52%;top:71%;width:27%;height:8.5%}
.art-school{left:22%;top:71%;width:27%;height:8.5%}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:650px){.lahoni-wrap{width:100%}.lahoni-hero{aspect-ratio:1776/864;border-radius:0}.art-hotspot{border-radius:9px}}

/* Lightweight, fully client-side interactive image hotspots; zero Firebase reads. */
.art-hotspot{z-index:6;touch-action:manipulation;transition:background-color .2s,box-shadow .2s,transform .2s}
.art-hotspot:hover{background:#ffffff27;box-shadow:0 0 0 2px #fff9,inset 0 0 18px #ffffff55;transform:translateY(-2px)}
.art-hotspot:active{transform:scale(.98);background:#ffffff40}
.art-hotspot:focus-visible{outline:3px solid #ffca38;outline-offset:2px}
.art-login{display:none!important}
.art-teacher{left:53%;top:70%;width:28%;height:8%}
.art-school{left:21%;top:70%;width:28%;height:8%}
.art-service{top:82%;height:14.2%;border-radius:16px}
.art-service-1{left:79%;width:15%}.art-service-2{left:63.2%;width:15%}.art-service-3{left:47.4%;width:15%}.art-service-4{left:31.6%;width:15%}.art-service-5{left:15.8%;width:15%}.art-service-6{left:0%;width:15%}

/* Align transparent clickable areas to the 16:9 artwork; accessible pointer and focus feedback. */
.lahoni-hero{aspect-ratio:16/9!important;background-size:100% 100%!important}
.art-hotspot{display:block!important;position:absolute!important;z-index:10!important;pointer-events:auto!important;cursor:pointer!important;border:2px solid transparent!important;border-radius:22px!important}
.art-hotspot:hover,.art-hotspot:focus-visible{background:rgba(255,255,255,.22)!important;box-shadow:inset 0 0 0 3px rgba(255,255,255,.85),0 0 18px #47b5ff88!important;transform:scale(1.015)}
.art-hotspot:active{background:#ffffff66!important;transform:scale(.98)}
.art-teacher{left:52.7%!important;top:62%!important;width:26.5%!important;height:8.5%!important}
.art-school{left:22.5%!important;top:62%!important;width:26.5%!important;height:8.5%!important}
.art-service{top:74.5%!important;height:17%!important;border-radius:18px!important}
.art-service-1{left:78.3%!important;width:14.2%!important}
.art-service-2{left:64.2%!important;width:13.6%!important}
.art-service-3{left:50.1%!important;width:13.6%!important}
.art-service-4{left:36%!important;width:13.6%!important}
.art-service-5{left:21.9%!important;width:13.6%!important}
.art-service-6{left:7.8%!important;width:13.6%!important}
@media(max-width:650px){.art-hotspot{border-radius:8px!important}.art-service{border-radius:8px!important}}
@media(prefers-reduced-motion:reduce){.art-hotspot{transition:none}.art-hotspot:hover,.art-hotspot:active{transform:none}}
`}</style>
<div className="lahoni-wrap">
<section className="lahoni-hero" id="home" aria-label="لحوني التعليمية — الصفحة الرئيسية">
  <Link className="art-hotspot art-teacher" href="/portal" aria-label="الدخول إلى بوابة أستاذ لحوني"><span className="sr-only">الدخول إلى بوابة أستاذ لحوني</span></Link>
  <Link className="art-hotspot art-school" href="/school" aria-label="استعراض بوابة المدرسة"><span className="sr-only">استعراض بوابة المدرسة</span></Link>
  <Link className="art-hotspot art-service art-service-1" href="/portal" aria-label="المساعد الذكي في بوابة أستاذ لحوني"><span className="sr-only">المساعد الذكي</span></Link>
  <Link className="art-hotspot art-service art-service-2" href="/portal" aria-label="شهادات الطلاب في بوابة أستاذ لحوني"><span className="sr-only">شهادات الطلاب</span></Link>
  <Link className="art-hotspot art-service art-service-3" href="/portal" aria-label="سجل الانضباط في بوابة أستاذ لحوني"><span className="sr-only">سجل الانضباط</span></Link>
  <Link className="art-hotspot art-service art-service-4" href="/portal" aria-label="متابعة التحصيل في بوابة أستاذ لحوني"><span className="sr-only">متابعة التحصيل</span></Link>
  <Link className="art-hotspot art-service art-service-5" href="/portal" aria-label="إدارة الفصول في بوابة أستاذ لحوني"><span className="sr-only">إدارة الفصول</span></Link>
  <Link className="art-hotspot art-service art-service-6" href="/portal" aria-label="التقارير الشاملة في بوابة أستاذ لحوني"><span className="sr-only">تقارير شاملة</span></Link>
</section>
</div></main>;
}
