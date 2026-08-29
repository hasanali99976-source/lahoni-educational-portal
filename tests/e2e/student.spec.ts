import { expect, test } from "@playwright/test";

test("يتحقق من صيغة كود الطالب قبل إرسال الطلب", async ({ page }) => {
  await page.goto("/student");
  await page.getByLabel("كود الطالب").fill("123");
  await page.getByRole("button", { name: "دخول الطالب" }).click();
  await expect(page.getByText(/كودًا صحيحًا/)).toBeVisible();
});

test("يفتح لوحة الطالب عند وجود مادة واحدة", async ({ page }) => {
  await page.route("**/api/student/lookup", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      matches: [{
        id: "TH2001",
        teacherId: "teacher-1",
        subjectKey: "history",
        subjectLabel: "التاريخ",
        teacherName: "أ. حسن الطويل",
        icon: "🏛️",
        accessToken: "test-token",
        data: { name: "طالب تجريبي", class: "الثاني الثانوي ١", accessCode: "TH2001", units: {} },
      }],
    }),
  }));
  await page.route("**/api/student/profile", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: { name: "طالب تجريبي", class: "الثاني الثانوي ١", accessCode: "TH2001", units: {} } }),
  }));

  await page.goto("/student");
  await page.getByLabel("كود الطالب").fill("TH2001");
  await page.getByRole("button", { name: "دخول الطالب" }).click();
  await expect(page.getByRole("heading", { name: "طالب تجريبي" })).toBeVisible();
  await expect(page.getByText("التاريخ", { exact: true }).first()).toBeVisible();
});
