import Link from "next/link";

export default function HomePage() {
  return <main dir="rtl">
    <h1>بوابة أستاذ لحوني التعليمية</h1>
    <p>تمت إزالة التصاميم القديمة. الواجهة الجديدة بانتظار الاعتماد.</p>
    <nav aria-label="روابط البوابات">
      <ul>
        <li><Link href="/admin">إدارة البوابة</Link></li>
        <li><Link href="/teacher">بوابة المعلم</Link></li>
        <li><Link href="/student">الطالب وولي الأمر</Link></li>
      </ul>
    </nav>
  </main>;
}
