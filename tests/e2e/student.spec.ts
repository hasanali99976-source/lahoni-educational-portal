import { expect, test } from "@playwright/test";

test("يتحقق من رقم هوية الطالب قبل إرسال الطلب", async ({ page }) => {
  await page.goto("/student");
  await page.getByLabel("رقم الهوية").fill("123");
  await page.getByLabel("كود الدخول").fill("ABCD");
  await page.getByRole("button", { name: "عرض المواد" }).click();
  await expect(page.getByText(/رقم هوية صحيح/)).toBeVisible();
});

test("يعرض المواد المرتبطة ديناميكيًا بعد التحقق", async ({ page }) => {
  await page.route("**/api/student/lookup", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, matches: [{ id: "s1", subjectKey: "history", subjectLabel: "التاريخ", teacherName: "أ. حسن الطويل", icon: "🏛️", data: { name: "طالب تجريبي", class: "٢/أ", nationalId: "1234567890", accessCode: "ABCD", units: {} } }] }) }));
  await page.goto("/student");
  await page.getByLabel("رقم الهوية").fill("1234567890");
  await page.getByLabel("كود الدخول").fill("ABCD");
  await page.getByRole("button", { name: "عرض المواد" }).click();
  await expect(page.getByRole("heading", { name: "اختر المادة" })).toBeVisible();
  await expect(page.getByText("التاريخ", { exact: true })).toBeVisible();
});
