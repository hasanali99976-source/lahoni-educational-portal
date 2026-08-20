import { expect, test } from "@playwright/test";

test("الرئيسية تعرض بوابات الدخول الثلاث دون تكرار", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /كل رحلة تعليمية/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "إدارة البوابة", exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "بوابة المعلم", exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "بوابة الطالب وولي الأمر", exact: true })).toHaveCount(1);
});

test("روابط الدخول تفتح الوجهة الصحيحة", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /بوابة المعلم/ }).click();
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByLabel("اسم المعلم")).toBeVisible();
});
