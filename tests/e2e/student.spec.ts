import { expect, test, type Page } from "@playwright/test";

const match = {
  id: "TH2001",
  teacherId: "teacher-1",
  subjectKey: "history",
  subjectLabel: "التاريخ",
  teacherName: "أ. حسن الطويل",
  icon: "🏛️",
  accessToken: "test-token",
  data: { name: "طالب تجريبي", class: "الثاني الثانوي ١", accessCode: "TH2001", units: {} },
};

async function mockStudent(page: Page) {
  await page.route("**/api/student/lookup", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, matches: [match] }),
  }));
  await page.route("**/api/student/profile", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: match.data }),
  }));
}

test("يتحقق من صيغة كود الطالب قبل إرسال الطلب", async ({ page }) => {
  await page.goto("/student");
  await page.getByLabel("كود الطالب").fill("123");
  await page.getByRole("button", { name: "دخول الطالب" }).click();
  await expect(page.getByText(/كودًا صحيحًا/)).toBeVisible();
});

test("يفتح لوحة الطالب عند وجود مادة واحدة", async ({ page }) => {
  await mockStudent(page);
  await page.goto("/student");
  await page.getByLabel("كود الطالب").fill("TH2001");
  await page.getByRole("button", { name: "دخول الطالب" }).click();
  await expect(page.getByRole("heading", { name: "طالب تجريبي" })).toBeVisible();
  await expect(page.getByText("التاريخ", { exact: true }).first()).toBeVisible();
});

test("دخول الباركود على الآيفون يفتح الطالب ويبقي الرجوع داخل بوابته", async ({ page }) => {
  await mockStudent(page);
  await page.goto("/");
  await page.goto("/student?code=TH2001&entry=iphone-qr&source=camera&v=46");
  await expect(page.getByRole("heading", { name: "طالب تجريبي" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("lahooni-student-qr-entry"))).toBe("1");
  await page.goBack();
  await expect(page).toHaveURL(/\/student/);
  await expect(page.getByRole("heading", { name: "طالب تجريبي" })).toBeVisible();
});

test("زر المواد يعيد قائمة مواد الطالب دون تسجيل دخول جديد", async ({ page }) => {
  await mockStudent(page);
  await page.goto("/student");
  await page.getByLabel("كود الطالب").fill("TH2001");
  await page.getByRole("button", { name: "دخول الطالب" }).click();
  await page.getByRole("button", { name: /المواد/ }).click();
  await expect(page.getByRole("heading", { name: "اختر المادة" })).toBeVisible();
  await expect(page.getByRole("button", { name: /التاريخ/ })).toBeVisible();
});

test("تسجيل خروج الطالب يمسح الجلسة ويعيد شاشة الدخول", async ({ page }) => {
  await mockStudent(page);
  await page.goto("/student");
  await page.getByLabel("كود الطالب").fill("TH2001");
  await page.getByRole("button", { name: "دخول الطالب" }).click();
  await page.getByRole("button", { name: /تسجيل الخروج/ }).click();
  await expect(page).toHaveURL(/\/student\?logout=/);
  await expect(page.getByRole("heading", { name: "دخول الطالب" })).toBeVisible();
});
