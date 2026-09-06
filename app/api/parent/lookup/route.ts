import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ولي الأمر يستخدم نفس بوابة الطالب ولا توجد بوابة مستقلة له.
 * أبقينا هذا المسار القديم فقط لإرجاع توجيه واضح لأي عميل أو رابط قديم،
 * من دون فك أكواد قديمة أو قراءة أرقام هوية أو تنفيذ استعلامات Firebase إضافية.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      retired: true,
      message: "دخول ولي الأمر أصبح من بوابة الطالب وولي الأمر الموحدة.",
      redirectTo: "/student",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
