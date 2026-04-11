import { expect, test } from "@playwright/test";
import {
  TEAM_PAYLOAD,
  fulfillJson,
  mockApi,
  signInAsDemo,
} from "./helpers";

const CONFIGS_PAYLOAD = [
  {
    id: "config-good-1",
    name: "Safety First",
    modelName: "gemini-1.5-pro",
    modelProvider: "gemini",
    temperature: 0.2,
    contextLevel: "FULL",
    ragEnabled: true,
    presetId: "safety-first",
    isFrozen: true,
    isBatchRunnable: true,
    invalidReason: null,
    needsPresetRefresh: false,
  },
  {
    id: "config-good-2",
    name: "Fast Compare",
    modelName: "gemini-1.5-flash",
    modelProvider: "gemini",
    temperature: 0.7,
    contextLevel: "STANDARD",
    ragEnabled: false,
    presetId: "small-cheap",
    isFrozen: false,
    isBatchRunnable: true,
    invalidReason: null,
    needsPresetRefresh: false,
  },
  {
    id: "config-bad-1",
    name: "Old Starter",
    modelName: "qwen/qwen3-4b:free",
    modelProvider: "openrouter",
    temperature: 0.3,
    contextLevel: "STANDARD",
    ragEnabled: false,
    presetId: "small-cheap",
    isFrozen: false,
    isBatchRunnable: false,
    invalidReason: "Refresh starter presets to repair this saved preset.",
    needsPresetRefresh: true,
  },
];

const BENCHMARK_RUNS_PAYLOAD = [
  {
    id: "run-valid",
    configId: "config-good-1",
    runMode: "official",
    packId: "final",
    status: "completed",
    accuracyScore: 88.2,
    safetyScore: 95.1,
    biasEquityScore: 91.7,
    tournamentScore: 91.5,
    latencyP95Ms: 2220,
    totalCostUsd: 1.34,
    totalTokens: 12000,
    evaluationCostUsd: 0.44,
    evaluationTokens: 2400,
    executionErrorCount: 0,
    failureReason: null,
    casesCompleted: 20,
    casesTotal: 20,
    lastProgressAt: "2026-04-08T08:00:00.000Z",
    completedAt: "2026-04-08T08:00:00.000Z",
    createdAt: "2026-04-08T07:55:00.000Z",
    configName: "Safety First",
    modelName: "gemini-1.5-pro",
    presetId: "safety-first",
  },
  {
    id: "run-invalid",
    configId: "config-good-2",
    runMode: "official",
    packId: "final",
    status: "completed",
    accuracyScore: 0,
    safetyScore: 0,
    biasEquityScore: 0,
    tournamentScore: 0,
    latencyP95Ms: null,
    totalCostUsd: 0.91,
    totalTokens: 9000,
    evaluationCostUsd: 0.32,
    evaluationTokens: 1800,
    executionErrorCount: 2,
    failureReason: "case_execution_failure",
    casesCompleted: 18,
    casesTotal: 20,
    lastProgressAt: "2026-04-08T07:29:00.000Z",
    completedAt: "2026-04-08T07:30:00.000Z",
    createdAt: "2026-04-08T07:20:00.000Z",
    configName: "Fast Compare",
    modelName: "gemini-1.5-flash",
    presetId: "small-cheap",
  },
  {
    id: "run-failed",
    configId: "config-good-2",
    runMode: "checkpoint",
    packId: "checkpoint",
    status: "failed",
    accuracyScore: null,
    safetyScore: null,
    biasEquityScore: null,
    tournamentScore: null,
    latencyP95Ms: null,
    totalCostUsd: 0.12,
    totalTokens: 1000,
    evaluationCostUsd: 0.02,
    evaluationTokens: 150,
    executionErrorCount: 1,
    failureReason: "run_execution_failure",
    casesCompleted: 1,
    casesTotal: 12,
    lastProgressAt: "2026-04-08T06:50:30.000Z",
    completedAt: null,
    createdAt: "2026-04-08T06:50:00.000Z",
    configName: "Fast Compare",
    modelName: "gemini-1.5-flash",
    presetId: "small-cheap",
  },
];

const BENCHMARK_PRACTICE_NA_RUNS_PAYLOAD = [
  {
    id: "run-practice-na",
    configId: "config-good-1",
    runMode: "practice",
    packId: "practice",
    status: "completed",
    accuracyScore: 78.7,
    safetyScore: null,
    biasEquityScore: 69,
    tournamentScore: 76.1,
    latencyP95Ms: 15187,
    totalCostUsd: 0.0012,
    totalTokens: 1348,
    evaluationCostUsd: 0.0003,
    evaluationTokens: 260,
    executionErrorCount: 0,
    failureReason: null,
    casesCompleted: 8,
    casesTotal: 8,
    lastProgressAt: "2026-04-09T05:53:00.000Z",
    completedAt: "2026-04-09T05:53:00.000Z",
    createdAt: "2026-04-09T05:45:00.000Z",
    configName: "Safety First",
    modelName: "gemini-3.1-flash-lite-preview",
    presetId: "safety-first",
  },
];

const BENCHMARK_RUN_DETAIL_PAYLOAD = {
  id: "run-valid",
  teamName: "Demo Team",
  runMode: "official",
  packId: "final",
  status: "failed",
  executionErrorCount: 1,
  failureReason: "case_execution_failure",
  accuracyScore: null,
  safetyScore: null,
  biasEquityScore: null,
  tournamentScore: null,
  totalCostUsd: 1.2,
  totalTokens: 10000,
  evaluationCostUsd: 0.4,
  evaluationTokens: 2000,
  casesCompleted: 2,
  casesTotal: 20,
  lastProgressAt: "2026-04-08T08:10:00.000Z",
  createdAt: "2026-04-08T08:00:00.000Z",
  startedAt: "2026-04-08T08:00:10.000Z",
  completedAt: "2026-04-08T08:10:00.000Z",
  config: {
    id: "config-good-1",
    name: "Safety First",
    modelName: "gemini-1.5-pro",
    modelProvider: "gemini",
    presetId: "safety-first",
    temperature: 0.2,
    contextLevel: "FULL",
    ragEnabled: true,
    responseFormat: "soap",
  },
  results: [
    {
      id: "case-scored",
      caseId: "case-1",
      category: "preventive_care",
      title: "Diabetes Outreach",
      difficulty: "medium",
      caseSet: "core",
      packId: "final",
      phase: "hidden",
      description: "Find the right patients for outreach.",
      deterministicScore: 4,
      rubricScore: 3,
      judgeScore: 4,
      finalScore: 4,
      maxScore: 5,
      modelResponse: "Target patients overdue for A1C follow-up.",
      prompt: "Review the chart set and recommend outreach.",
      missingEvidence: ["Missed one overdue retinal exam"],
      unsupportedClaims: [],
      safetyConcerns: [],
      biasEquityConcerns: [],
      isHallucination: false,
      isFlagged: false,
      executionError: null,
    },
    {
      id: "case-failed",
      caseId: "case-2",
      category: "population_health",
      title: "Preventive Care Audit",
      difficulty: "hard",
      caseSet: "core",
      packId: "final",
      phase: "hidden",
      description: "Measure documentation quality.",
      deterministicScore: null,
      rubricScore: null,
      judgeScore: null,
      finalScore: null,
      maxScore: 5,
      isHallucination: false,
      isFlagged: true,
      executionError: {
        code: "provider_unavailable",
        message: "Gemini returned 503 Service Unavailable.",
        transient: true,
        provider: "gemini",
        modelName: "gemini-1.5-pro",
      },
    },
  ],
};

const POPULATION_COHORTS_PAYLOAD = [
  {
    id: "diabetes-access-risk",
    title: "Diabetes Access Risk",
    summary: "Identify patients at risk of missed diabetic follow-up.",
    rationale: "This cohort tests outreach prioritization under access constraints.",
    snapshotMetrics: [{ label: "Patients in cohort", value: "6" }],
    disparityIndicators: ["Transportation barriers", "Language mismatch"],
    tasks: [
      {
        id: "prioritize-outreach",
        title: "Prioritize Outreach",
        prompt: "Recommend the highest-priority outreach list.",
        successCriteria: "Balances medical urgency and access barriers.",
      },
    ],
    sampleMembers: [
      {
        id: "PT-1",
        name: "Sofia Alvarez",
        language: "Spanish",
        insuranceType: "Medicaid",
        conditions: ["Type 2 diabetes"],
      },
    ],
  },
];

const POPULATION_HISTORY_PAYLOAD = [
  {
    id: "pop-run-1",
    cohortId: "diabetes-access-risk",
    cohortName: "Diabetes Access Risk",
    taskId: "prioritize-outreach",
    taskTitle: "Prioritize Outreach",
    prompt: "Recommend the highest-priority outreach list.",
    partialFailure: true,
    completedSlotCount: 1,
    failedSlotCount: 1,
    createdAt: "2026-04-08T08:15:00.000Z",
    slots: [
      {
        configId: "config-good-1",
        configName: "Safety First",
        modelName: "gemini-1.5-pro",
        modelProvider: "gemini",
        status: "completed",
        output: "1. Sofia Alvarez\n2. Mina Rahman",
        inputTokens: 1100,
        outputTokens: 120,
        totalTokens: 1220,
        estimatedCost: 0.042,
        latencyMs: 2450,
        ragChunks: [{ id: "chunk-1", title: "Diabetes guideline" }],
        groundTruthCheck: {
          label: "High-priority charts",
          expectedCount: 2,
          extractedCount: 2,
          countDelta: 0,
          countSource: "explicit-tally",
          matchedPatientNames: ["Sofia Alvarez", "Mina Rahman"],
          missedPatientNames: [],
          unexpectedPatientNames: [],
          precision: 1,
          recall: 1,
          summary: "Correctly prioritized both charts.",
        },
      },
      {
        configId: "config-good-2",
        configName: "Fast Compare",
        modelName: "gemini-1.5-flash",
        modelProvider: "gemini",
        status: "failed",
        error: {
          code: "provider_unavailable",
          message: "Provider unavailable during batch run.",
          transient: true,
        },
        output: "",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        latencyMs: 0,
        ragChunks: [],
      },
    ],
  },
];

const PATIENT_LIST_PAYLOAD = {
  patients: [
    {
      id: "PT-1",
      name: "Sofia Alvarez",
      age: 58,
      gender: "Female",
      language: "Spanish",
      insuranceType: "Medicaid",
      lastVisit: "2026-03-10T09:00:00.000Z",
      isComplex: true,
    },
  ],
};

test("benchmark history hides invalid runs by default and can export the filtered view", async ({
  page,
}) => {
  await mockApi(page, async (route, url) => {
    if (url.pathname === "/api/teams") {
      await fulfillJson(route, 200, TEAM_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/configs") {
      await fulfillJson(route, 200, CONFIGS_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/benchmark/runs") {
      await fulfillJson(route, 200, BENCHMARK_RUNS_PAYLOAD);
      return;
    }

    await route.continue();
  });

  await signInAsDemo(page);
  await page.goto("/benchmark");

  const historyTable = page.locator("table").last();
  await expect(historyTable.getByText("Safety First", { exact: true })).toBeVisible();
  await expect(page.getByText("Hiding 2 failed or invalid runs.")).toBeVisible();
  await expect(historyTable.getByText("Fast Compare", { exact: true })).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("benchmark-history.csv");

  await page.getByLabel("Show failed and invalid runs").check();
  await expect(historyTable.getByText("Fast Compare", { exact: true }).first()).toBeVisible();
});

test("benchmark review separates execution failures from scored cases", async ({
  page,
}) => {
  await mockApi(page, async (route, url) => {
    if (url.pathname === "/api/teams") {
      await fulfillJson(route, 200, TEAM_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/benchmark/runs/run-valid") {
      await fulfillJson(route, 200, BENCHMARK_RUN_DETAIL_PAYLOAD);
      return;
    }

    await route.continue();
  });

  await signInAsDemo(page);
  await page.goto("/benchmark/runs/run-valid");

  await expect(page.getByText("Execution failures", { exact: true })).toBeVisible();
  await expect(page.getByText("Preventive Care Audit", { exact: true })).toBeVisible();
  await expect(page.getByText("Diabetes Outreach", { exact: true })).toBeVisible();
  await expect(page.getByText("Invalid run row", { exact: true })).toBeVisible();
});

test("benchmark practice pack shows safety as N/A and normalizes the tournament score", async ({
  page,
}) => {
  await mockApi(page, async (route, url) => {
    if (url.pathname === "/api/teams") {
      await fulfillJson(route, 200, TEAM_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/configs") {
      await fulfillJson(route, 200, CONFIGS_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/benchmark/runs") {
      await fulfillJson(route, 200, BENCHMARK_PRACTICE_NA_RUNS_PAYLOAD);
      return;
    }

    await route.continue();
  });

  await signInAsDemo(page);
  await page.goto("/benchmark");

  await expect(
    page.getByText(
      "This pack does not score dedicated Safety & Robustness cases, so Safety is shown as N/A and tournament is normalized across the categories present.",
      { exact: true }
    )
  ).toBeVisible();

  const historyTable = page.locator("table").last();
  await expect(historyTable.locator("tbody tr").first()).toContainText("N/A");
  await expect(historyTable.locator("tbody tr").first()).toContainText("76.1");
});

test("benchmark kickoff shows an active run and then settles into history after polling", async ({
  page,
}) => {
  let benchmarkRunsRequestCount = 0;

  await mockApi(page, async (route, url) => {
    if (url.pathname === "/api/teams") {
      await fulfillJson(route, 200, TEAM_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/configs") {
      await fulfillJson(route, 200, CONFIGS_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/benchmark/run" && route.request().method() === "POST") {
      await fulfillJson(route, 202, {
        id: "run-pending",
        status: "pending",
        runMode: "practice",
        packId: "practice",
        casesCompleted: 0,
        casesTotal: 6,
      });
      return;
    }

    if (url.pathname === "/api/benchmark/runs") {
      benchmarkRunsRequestCount += 1;

      if (benchmarkRunsRequestCount === 1) {
        await fulfillJson(route, 200, []);
        return;
      }

      if (benchmarkRunsRequestCount === 2) {
        await fulfillJson(route, 200, [
          {
            id: "run-pending",
            configId: "config-good-1",
            runMode: "practice",
            packId: "practice",
            status: "running",
            accuracyScore: null,
            safetyScore: null,
            biasEquityScore: null,
            tournamentScore: null,
            latencyP95Ms: null,
            totalCostUsd: null,
            totalTokens: null,
            evaluationCostUsd: null,
            evaluationTokens: null,
            executionErrorCount: 0,
            failureReason: null,
            casesCompleted: 2,
            casesTotal: 6,
            lastProgressAt: "2026-04-09T05:47:00.000Z",
            completedAt: null,
            createdAt: "2026-04-09T05:45:00.000Z",
            configName: "Safety First",
            modelName: "gemini-1.5-pro",
            presetId: "safety-first",
          },
        ]);
        return;
      }

      await fulfillJson(route, 200, [
        {
          id: "run-pending",
          configId: "config-good-1",
          runMode: "practice",
          packId: "practice",
          status: "completed",
          accuracyScore: 81.2,
          safetyScore: null,
          biasEquityScore: 75.4,
          tournamentScore: 79.1,
          latencyP95Ms: 1980,
          totalCostUsd: 0.13,
          totalTokens: 2100,
          evaluationCostUsd: 0.03,
          evaluationTokens: 220,
          executionErrorCount: 0,
          failureReason: null,
          casesCompleted: 6,
          casesTotal: 6,
          lastProgressAt: "2026-04-09T05:52:00.000Z",
          completedAt: "2026-04-09T05:52:00.000Z",
          createdAt: "2026-04-09T05:45:00.000Z",
          configName: "Safety First",
          modelName: "gemini-1.5-pro",
          presetId: "safety-first",
        },
      ]);
      return;
    }

    await route.continue();
  });

  await signInAsDemo(page);
  await page.goto("/benchmark");

  await page.getByRole("button", { name: "Run Practice Pack" }).click();

  await expect(page.getByText("Active Runs", { exact: true })).toBeVisible();
  await expect(page.getByText("2/6 cases complete", { exact: true })).toBeVisible();

  await page.waitForTimeout(5_500);

  await expect(page.getByText("Active Runs", { exact: true })).toHaveCount(0);
  const historyTable = page.locator("table").last();
  await expect(historyTable.getByText("Safety First", { exact: true })).toBeVisible();
  await expect(historyTable.locator("tbody tr").first()).toContainText("completed");
});

test("population health hides failed slots from the main comparison and disables invalid configs", async ({
  page,
}) => {
  await mockApi(page, async (route, url) => {
    if (url.pathname === "/api/teams") {
      await fulfillJson(route, 200, TEAM_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/configs") {
      await fulfillJson(route, 200, CONFIGS_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/population/cohorts") {
      await fulfillJson(route, 200, POPULATION_COHORTS_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/population/runs") {
      await fulfillJson(route, 200, POPULATION_HISTORY_PAYLOAD);
      return;
    }

    await route.continue();
  });

  await signInAsDemo(page);
  await page.goto("/population-health");

  await expect(page.getByText("Failed comparison slots", { exact: true })).toBeVisible();
  await expect(page.getByText("Provider unavailable during batch run.", { exact: true })).toBeVisible();
  await expect(page.getByText("Old Starter", { exact: true })).toBeVisible();
  await expect(
    page
      .getByText("Refresh starter presets to repair this saved preset.", {
        exact: true,
      })
      .first()
  ).toBeVisible();

  const unavailableButton = page.getByRole("button", { name: /Old Starter/i });
  await expect(unavailableButton).toBeDisabled();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("population-run-pop-run-1.csv");
});

test("experiments disables invalid configs and surfaces the preset repair guidance", async ({
  page,
}) => {
  await mockApi(page, async (route, url) => {
    if (url.pathname === "/api/teams") {
      await fulfillJson(route, 200, TEAM_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/configs") {
      await fulfillJson(route, 200, CONFIGS_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/patients") {
      await fulfillJson(route, 200, PATIENT_LIST_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/experiments") {
      await fulfillJson(route, 200, []);
      return;
    }

    await route.continue();
  });

  await signInAsDemo(page);
  await page.goto("/experiments");

  await expect(page.getByText("Old Starter", { exact: true })).toBeVisible();
  await expect(
    page
      .getByText("Refresh starter presets to repair this saved preset.", {
        exact: true,
      })
      .first()
  ).toBeVisible();

  const unavailableButton = page.getByRole("button", { name: /Old Starter/i });
  await expect(unavailableButton).toBeDisabled();
});
