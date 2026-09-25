import { expect, test, type Page } from "@playwright/test";
import { openTab, signIn, testEmail } from "./helpers";

interface WeekSummary {
  week: number;
  state: "unavailable" | "upcoming" | "open" | "closed";
  mode: "fixed" | "drawn";
  legacy: boolean;
  graded: boolean;
  questionCount: number;
  attemptsUsed: number;
  canStart: boolean;
}

async function quizList(page: Page) {
  const response = await page.request.get("/api/quizzes");
  expect(response.ok()).toBe(true);
  return (await response.json()) as { weeks: WeekSummary[]; windowsEnabled: boolean };
}

function weekButton(page: Page, week: number) {
  return page.locator(".assignment-list button").filter({ has: page.locator(".assignment-number", { hasText: new RegExp(`^W${week}$`) }) });
}

async function submitWithConfirm(page: Page) {
  await page.getByRole("button", { name: "Submit attempt" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit attempt" }).click();
}

test("the quiz list shows all twelve weeks with window status", async ({ page }) => {
  await signIn(page, testEmail("quiz-list"));
  await page.goto("/quiz");
  await expect(page).toHaveURL(/\/quizzes/);
  await openTab(page, "Quizzes");
  const list = await quizList(page);
  expect(list.weeks.map((week) => week.week)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  await expect(page.locator(".assignment-list button")).toHaveCount(12);
  for (const week of list.weeks.filter((item) => item.state === "unavailable")) {
    await expect(weekButton(page, week.week)).toContainText("Not yet available");
  }
  for (const week of list.weeks.filter((item) => item.state === "upcoming")) {
    await expect(weekButton(page, week.week)).toContainText(/Opens \w{3} \w{3} \d{1,2}, \d{1,2}:\d{2} [AP]M/);
  }
  // Week 12 exists but has not opened yet, so starting it is refused
  // (403 "not open yet" with migration 012; 409 in the pre-migration fallback).
  const refused = await page.request.post("/api/quizzes/12/start", { data: {} });
  expect([403, 409]).toContain(refused.status());
});

test("legacy week 1: two graded attempts, answers hidden until the close, third attempt refused", async ({ page }) => {
  await signIn(page, testEmail("quiz"));
  await openTab(page, "Quizzes");
  const week1 = (await quizList(page)).weeks.find((week) => week.week === 1)!;
  expect(week1.legacy).toBe(true);
  expect(week1.mode).toBe("fixed");
  test.skip(week1.state !== "open", `Week 1 is ${week1.state}; the legacy attempt flow needs an open window.`);

  await weekButton(page, 1).click();
  await expect(page.getByRole("heading", { name: /Week 1:/ })).toBeVisible();
  await expect(page.locator(".quiz-timer")).toHaveCount(0);
  const items = page.locator(".quiz-item");
  await expect(items).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) await items.nth(index).locator("input[type=radio]").nth(1).check();
  await submitWithConfirm(page);
  await expect(page.getByText(/Attempt recorded/)).toBeVisible();
  await expect(page.getByText(/1 attempt\(s\) remaining/)).toBeVisible();
  await expect(page.locator(".quiz-rationale")).toHaveCount(0);
  await expect(page.getByText(/appear after the quiz closes/).first()).toBeVisible();

  await page.getByRole("button", { name: "Back to quiz" }).click();
  for (let index = 0; index < 6; index += 1) await page.locator(".quiz-item").nth(index).locator("input[type=radio]").nth(2).check();
  await submitWithConfirm(page);
  await expect(page.getByText(/No attempts remain/)).toBeVisible();
  // Graded feedback stays locked until the window closes, even after the final attempt.
  await expect(page.locator(".quiz-rationale")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to quiz" }).click();
  await expect(page.getByRole("button", { name: /Submit attempt|Start attempt/ })).toHaveCount(0);
  await expect(page.locator(".quiz-attempts tbody tr")).toHaveCount(2);

  const refused = await page.request.post("/api/quizzes/1", { data: { answers: [0, 0, 0, 0, 0, 0] } });
  expect(refused.status()).toBe(409);
  const detail = await (await page.request.get("/api/quizzes/1")).json();
  expect(JSON.stringify(detail)).not.toMatch(/rationale/);
});

test("drawn weeks: timed attempt resumes after reload without redrawing", async ({ page }) => {
  await signIn(page, testEmail("quiz-timed"));
  await openTab(page, "Quizzes");
  const list = await quizList(page);
  test.skip(!list.windowsEnabled, "Migration 012 is not applied; timed, drawn quizzes are disabled (fallback mode).");
  const target = list.weeks.find((week) => week.mode === "drawn" && week.state === "open" && week.canStart);
  test.skip(!target, "No drawn quiz is open right now.");

  await weekButton(page, target!.week).click();
  await page.getByRole("button", { name: /Start attempt/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start now" }).click();
  const items = page.locator(".quiz-item");
  await expect(items).toHaveCount(target!.questionCount);
  const firstStem = await items.first().locator("legend").innerText();
  await items.first().locator("input[type=radio]").first().check();
  await expect(page.locator(".quiz-autosave")).toContainText("Saved", { timeout: 15_000 });

  await page.reload();
  await openTab(page, "Quizzes");
  await weekButton(page, target!.week).click();
  await expect(page.locator(".quiz-item").first().locator("legend")).toHaveText(firstStem);
  await expect(page.locator(".quiz-item").first().locator("input[type=radio]").first()).toBeChecked();

  const detail = await (await page.request.get(`/api/quizzes/${target!.week}`)).json();
  expect(detail.inProgress.attempt).toBe(1);
  expect(JSON.stringify(detail.inProgress)).not.toMatch(/"correct"|rationale/);

  await submitWithConfirm(page);
  await expect(page.getByText(/Attempt recorded|Time expired/)).toBeVisible();
});

test("instructors see quiz settings, results, and CSV exports", async ({ page }) => {
  await signIn(page, testEmail("quiz-instructor"), "instructor");
  await openTab(page, "Gradebook");
  await page.locator(".panel-actions").getByRole("button", { name: "Quizzes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Quiz results" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quiz settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Item analysis" })).toBeVisible();

  const overview = await (await page.request.get("/api/instructor/quizzes?includeTest=1")).json();
  expect(overview.weeks).toHaveLength(12);
  if (!overview.schema.windows) await expect(page.getByText("Apply migration 012 to enable timed quizzes")).toBeVisible();

  const category = await page.request.get("/api/instructor/export?scope=quiz-category&includeTest=1");
  expect(category.status()).toBe(200);
  expect(await category.text()).toContain('"Email","Quiz Category [Total Pts: 100 Score]"');
  const blackboard = await page.request.get("/api/instructor/export?scope=quizzes");
  expect(await blackboard.text()).toContain("Quiz Week 1 [Total Pts: 100 Score]");
  const items = await page.request.get("/api/instructor/export?scope=quiz-items&week=1");
  expect(await items.text()).toContain('"Item","Question","Correct option","Times drawn","Percent correct"');

  const student = await page.context().browser()!.newContext();
  const studentPage = await student.newPage();
  await signIn(studentPage, testEmail("quiz-not-instructor"));
  expect((await studentPage.request.get("/api/instructor/quizzes")).status()).toBe(403);
  await student.close();
});

test("timed attempt UI: countdown, warning, announcements, autosave, and submit confirmation (mocked API)", async ({ page }) => {
  await signIn(page, testEmail("quiz-ui"));
  const questions = Array.from({ length: 6 }, (_, index) => ({ id: `MOCK-Q${index + 1}`, question: `Mock question ${index + 1}?`, options: ["One", "Two", "Three", "Four"] }));
  const summary = {
    week: 3, title: "Mock graded week", date: "2026-10-05", graded: true, available: true, legacy: false, mode: "drawn", state: "open",
    opensAt: "2026-10-05T21:00:00-04:00", closesAt: "2026-10-11T23:59:00-04:00", timeLimitMin: 15, extraMinutes: 0, closeOverridden: false,
    questionCount: 6, attemptsUsed: 1, attemptsAllowed: 2, bestScore: null, inProgress: true, canStart: false, blockedReason: null,
    feedbackUnlocked: false, lastSubmittedAt: null,
  };
  const saves: unknown[] = [];
  let submitted: unknown = null;
  await page.route("**/api/quizzes", (route) => route.fulfill({ json: { weeks: [summary], category: { score: null, counted: 0, dropped: null, droppedWeek: null }, windowsEnabled: true, serverNow: new Date().toISOString() } }));
  await page.route("**/api/quizzes/3", async (route) => {
    const method = route.request().method();
    if (method === "PATCH") {
      saves.push(route.request().postDataJSON());
      return route.fulfill({ json: { saved: true, finalized: false, savedAt: new Date().toISOString(), remainingSeconds: 60 } });
    }
    if (method === "POST") {
      submitted = route.request().postDataJSON();
      return route.fulfill({ json: { attempt: 1, status: "submitted", score: 50, correctCount: 3, total: 6, late: false, attemptsRemaining: 1, bestScore: 50, feedback: { unlocked: false, unlocksAt: summary.closesAt, rule: "after_close" }, review: null } });
    }
    const inProgress = submitted ? null : { attempt: 1, startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 62_000).toISOString(), remainingSeconds: 62, timeLimitMin: 15, questions, answers: [null, null, null, null, null, null] };
    return route.fulfill({ json: { ...summary, inProgress, feedback: { unlocked: false, unlocksAt: summary.closesAt, rule: "after_close" }, attempts: [], fixedQuestions: null, startMinutes: 15, serverNow: new Date().toISOString() } });
  });

  await openTab(page, "Quizzes");
  await weekButton(page, 3).click();
  const timer = page.getByRole("timer");
  await expect(timer).toBeVisible();
  await expect(page.locator(".quiz-toolbar")).toHaveClass(/warning/);
  await expect(page.locator("[aria-live=polite]").filter({ hasText: "1 minute remaining." })).toHaveCount(1, { timeout: 10_000 });

  await page.getByRole("group", { name: "Mock question 2?" }).getByLabel("Three").check();
  await expect(page.locator(".quiz-autosave")).toContainText("Saved");
  expect(saves.at(-1)).toEqual({ attempt: 1, answers: [null, 2, null, null, null, null] });
  await expect(page.locator(".quiz-progress")).toHaveText("1 of 6 answered");

  await page.getByRole("button", { name: "Submit attempt" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("5 questions are unanswered");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await submitWithConfirm(page);
  await expect(page.getByText(/Attempt recorded: 50%/)).toBeVisible();
  expect(submitted).toEqual({ attempt: 1, answers: [null, 2, null, null, null, null] });
  await expect(page.getByText(/appear after the quiz closes/).first()).toBeVisible();
});
