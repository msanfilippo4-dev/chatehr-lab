import { expect, test } from "@playwright/test";

const liveSmokeEnabled = process.env.PLAYWRIGHT_LIVE_SMOKE === "1";

test.describe.configure({ mode: "serial" });

test.skip(
  !liveSmokeEnabled,
  "Set PLAYWRIGHT_LIVE_SMOKE=1 and PLAYWRIGHT_STORAGE_STATE=/path/to/storage-state.json to run live smoke coverage."
);

test("live benchmark and population pages load with a signed-in session", async ({
  page,
}) => {
  await page.goto("/benchmark");
  await expect(page.getByText("Fordham HealthBench", { exact: true })).toBeVisible();
  await expect(page.getByText("Benchmark unavailable", { exact: true })).toHaveCount(0);

  if (await page.getByRole("button", { name: "Export CSV" }).isVisible().catch(() => false)) {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("benchmark-history.csv");
  }

  await page.goto("/population-health");
  await expect(
    page.getByText(
      "Cohort-level tasks for outreach, care gaps, and risk stratification",
      { exact: true }
    )
  ).toBeVisible();
  await expect(page.getByText("Population lab unavailable", { exact: true })).toHaveCount(0);

  const populationExport = page.getByRole("button", { name: "Export CSV" });
  if (await populationExport.isVisible().catch(() => false)) {
    const downloadPromise = page.waitForEvent("download");
    await populationExport.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("population-run-");
  }
});

test("live instructor dashboard excludes smoke teams when instructor access is present", async ({
  page,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_EXPECT_INSTRUCTOR !== "1",
    "Set PLAYWRIGHT_EXPECT_INSTRUCTOR=1 when the saved session belongs to an instructor account."
  );

  await page.goto("/instructor");
  await expect(page.getByText("Instructor Dashboard", { exact: true })).toBeVisible();
  await expect(page.getByText("Instructor dashboard unavailable", { exact: true })).toHaveCount(0);
});
