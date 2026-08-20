import { expect, test } from "@playwright/test";

test("يعرض خطأ الدخول بدون كشف تفاصيل الحساب", async ({ page }) => {
  await page.route("**/api/teacher-login", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" }) }));
  await page.goto("/teacher");
  await page.getByLabel("اسم المستخدم").fill("unknown");
  await page.getByLabel("كلمة المرور").fill("wrong-password");
  await page.getByRole("button", { name: /دخول إلى بوابة المعلم/ }).click();
  await expect(page.getByText("اسم المستخدم أو كلمة المرور غير صحيحة")).toBeVisible();
});
