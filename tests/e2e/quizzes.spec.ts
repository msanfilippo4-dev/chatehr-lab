import { expect, test } from "@playwright/test";
import { openTab, signIn, testEmail } from "./helpers";

test("a student takes a review quiz, sees rationales, and graded quizzes enforce two attempts", async ({ page }) => {
  await signIn(page, testEmail("quiz"));
  await page.goto("/quiz");
  await expect(page).toHaveURL(/\/quizzes/);
  await openTab(page, "Quizzes");
  await page.locator(".assignment-list button").filter({ has: page.locator(".assignment-number", { hasText: /^W2$/ }) }).click();
  await expect(page.getByRole("heading", { name: /Week 2:/ })).toBeVisible();
  for (let index = 0; index < 6; index += 1) await page.locator(".quiz-item").nth(index).locator("input[type=radio]").first().check();
  await page.getByRole("button", { name: "Submit attempt" }).click();
  await expect(page.getByText(/Attempt recorded/)).toBeVisible();
  await expect(page.locator(".quiz-rationale").first()).toBeVisible();
  // Graded week: attempt 1 gives a score but no rationales; attempt 2 unlocks them; attempt 3 is refused.
  await page.locator(".assignment-list button").filter({ has: page.locator(".assignment-number", { hasText: /^W1$/ }) }).click();
  await expect(page.getByRole("heading", { name: /Week 1:/ })).toBeVisible();
  for (let index = 0; index < 6; index += 1) await page.locator(".quiz-item").nth(index).locator("input[type=radio]").nth(1).check();
  await page.getByRole("button", { name: "Submit attempt" }).click();
  await expect(page.getByText(/1 attempt\(s\) remaining/)).toBeVisible();
  await expect(page.locator(".quiz-rationale")).toHaveCount(0);
  for (let index = 0; index < 6; index += 1) await page.locator(".quiz-item").nth(index).locator("input[type=radio]").nth(2).check();
  await page.getByRole("button", { name: "Submit attempt" }).click();
  await expect(page.getByText(/No attempts remain/)).toBeVisible();
  await expect(page.locator(".quiz-rationale").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit attempt" })).toHaveCount(0);
  const refused = await page.request.post("/api/quizzes/1", { data: { answers: [0, 0, 0, 0, 0, 0] } });
  expect(refused.status()).toBe(409);
});
