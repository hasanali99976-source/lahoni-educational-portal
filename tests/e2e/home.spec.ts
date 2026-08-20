import { expect, test } from "@playwright/test";

test("الرئيسية تعرض بوابتي المعلم والطالب دون تكرار", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /منصة تعليمية مرتبة/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "بوابة المعلم", exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "بوابة الطالب / ولي الأمر", exact: true })).toHaveCount(1);
});

test("روابط الدخول تفتح الوجهة الصحيحة", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "دخول المعلم" }).click();
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByLabel("اسم المستخدم")).toBeVisible();
});
