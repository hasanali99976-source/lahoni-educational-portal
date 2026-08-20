import Link from "next/link";

export default function FamilyGatewayPage(){
 return <main className="v3-family" dir="rtl"><header><Link href="/">← العودة إلى البوابة الرئيسية</Link><span>بوابة الطالب وولي الأمر</span><h1>اختر طريقة الدخول</h1><p>مساحتان واضحتان وآمنتان للطالب وولي أمره.</p></header><section><Link href="/student" className="student"><span>◎</span><div><small>دخول الطالب</small><h2>بوابة الطالب</h2><p>الدخول برقم الهوية وكود الطالب، ثم عرض الدرجات والتقدم والخطة التعليمية.</p></div><b>دخول ←</b></Link><Link href="/parent" className="parent"><span>⌂</span><div><small>دخول ولي الأمر</small><h2>بوابة ولي الأمر</h2><p>الدخول بكود ولي الأمر لمتابعة الأبناء والغياب والتنبيهات.</p></div><b>دخول ←</b></Link></section></main>
}
