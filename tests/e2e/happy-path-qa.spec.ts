import { expect, test } from "@playwright/test";
import {
  NO_TEAM_PAYLOAD,
  TEAM_PAYLOAD,
  fulfillJson,
  mockApi,
  signInAsDemo,
} from "./helpers";

const TEAM_SETTINGS_PAYLOAD = {
  id: "team-demo",
  name: "Demo Team",
  joinCode: "REAL1234",
  role: "lead",
  memberCount: 3,
  members: [
    {
      userId: "user-1",
      name: "Demo User",
      email: "demo@fordham.edu",
      role: "lead",
      platformRole: "student",
      joinedAt: "2026-03-10T15:00:00.000Z",
    },
    {
      userId: "user-2",
      name: "Alex Rivera",
      email: "alex@fordham.edu",
      role: "member",
      platformRole: "student",
      joinedAt: "2026-03-10T15:05:00.000Z",
    },
    {
      userId: "user-3",
      name: "Jordan Kim",
      email: "jordan@fordham.edu",
      role: "member",
      platformRole: "student",
      joinedAt: "2026-03-10T15:10:00.000Z",
    },
  ],
};

const CONFIGS_PAYLOAD = [
  {
    id: "config-1",
    name: "Safety First",
    modelName: "gemini-1.5-pro",
    modelProvider: "gemini",
    temperature: 0.2,
    contextLevel: "FULL",
    ragEnabled: true,
    presetId: "safety-first",
    isFrozen: true,
    version: 3,
  },
  {
    id: "config-2",
    name: "Fast Compare",
    modelName: "gemini-1.5-flash",
    modelProvider: "gemini",
    temperature: 0.7,
    contextLevel: "STANDARD",
    ragEnabled: false,
    presetId: "small-cheap",
    isFrozen: false,
    version: 1,
  },
];

const POPULATION_COHORTS_PAYLOAD = [
  {
    id: "sensitive-exam-documentation-audit",
    title: "Sensitive Exam Documentation Audit",
    summary:
      "A note-review cohort where students must separate explicit chaperone use from similar note language that should not be counted.",
    rationale:
      "This cohort measures whether the model can audit a note-level documentation signal across multiple charts.",
    snapshotMetrics: [
      { label: "Charts in audit sample", value: "4" },
      { label: "Interpreter-involved visits", value: "2" },
    ],
    disparityIndicators: [
      "Interpreter use changes how documentation details appear in the chart.",
      "Keyword-only matching can overcount when a chaperone was offered or declined.",
    ],
    tasks: [
      {
        id: "tally-explicit-chaperone-use",
        title: "Tally Explicit Chaperone Use",
        prompt:
          "Identify only the charts where the note explicitly documents that a chaperone was present during a breast or pelvic exam, then provide a tally and patient IDs.",
        successCriteria:
          "Counts only charts with explicit chaperone use and avoids false positives.",
        contextMode: "note-review",
        accuracyMeasurement:
          "Compare the model's tally and patient list against hidden ground truth after the run.",
      },
    ],
    sampleMembers: [
      {
        id: "PT-TCH-001",
        name: "Evelyn Carter",
        language: "English",
        insuranceType: "Medicare",
        conditions: ["Chronic kidney disease", "Hypertension"],
      },
      {
        id: "PT-TCH-002",
        name: "Sofia Alvarez",
        language: "Spanish",
        insuranceType: "Medicaid",
        conditions: ["Type 2 diabetes", "Hyperlipidemia"],
      },
      {
        id: "PT-TCH-004",
        name: "Mina Rahman",
        language: "Bengali",
        insuranceType: "Medicaid",
        conditions: ["Type 2 diabetes", "Hypertension"],
      },
      {
        id: "PT-TCH-008",
        name: "Aisha Khan",
        language: "English",
        insuranceType: "Private",
        conditions: ["Depression"],
      },
    ],
  },
];

const POPULATION_RUN_PAYLOAD = {
  id: "pop-run-1",
  cohortId: "sensitive-exam-documentation-audit",
  cohortName: "Sensitive Exam Documentation Audit",
  taskId: "tally-explicit-chaperone-use",
  taskTitle: "Tally Explicit Chaperone Use",
  prompt:
    "Identify only the charts where the note explicitly documents that a chaperone was present during a breast or pelvic exam, then provide a tally and patient IDs.",
  slots: [
    {
      configId: "config-1",
      configName: "Safety First",
      modelName: "gemini-1.5-pro",
      modelProvider: "gemini",
      output:
        "Count: 2\nPatient IDs: PT-TCH-002, PT-TCH-004\n- PT-TCH-002: \"MA Ana Lopez served as chaperone during the pelvic exam.\"\n- PT-TCH-004: \"RN Samira Begum was present as chaperone for the breast and pelvic exam.\"",
      inputTokens: 900,
      outputTokens: 180,
      totalTokens: 1080,
      estimatedCost: 0.0234,
      latencyMs: 2100,
      ragChunks: [],
      groundTruthCheck: {
        label: "Charts with explicit chaperone use documented in the note",
        expectedCount: 2,
        extractedCount: 2,
        countDelta: 0,
        countSource: "explicit-tally",
        matchedPatientNames: ["Sofia Alvarez", "Mina Rahman"],
        missedPatientNames: [],
        unexpectedPatientNames: [],
        precision: 1,
        recall: 1,
        summary:
          "Model tally 2 vs ground truth 2. Correct charts: Sofia Alvarez, Mina Rahman.",
        note: "Only actual chaperone use counts. Offered or declined chaperones do not count.",
      },
    },
  ],
  createdAt: "2026-03-17T15:00:00.000Z",
};

const PATIENT_LIST_PAYLOAD = {
  patients: [
    {
      id: "PAT-001",
      name: "Jane Doe",
      dob: "1967-04-12",
      age: 58,
      gender: "F",
      race: "White",
      ethnicity: "Not Hispanic or Latino",
      language: "English",
      maritalStatus: undefined,
      addressZip: undefined,
      insuranceType: "Medicare Advantage",
      lastVisit: "2026-02-25",
      isComplex: true,
      conditions: [],
      labs: [],
      immunizations: [],
      medications: [],
      allergies: [],
      visits: [],
    },
    {
      id: "PAT-002",
      name: "Marcus Lee",
      dob: "1981-01-09",
      age: 44,
      gender: "M",
      race: "Asian",
      ethnicity: "Not Hispanic or Latino",
      language: "English",
      maritalStatus: undefined,
      addressZip: undefined,
      insuranceType: "Commercial PPO",
      lastVisit: "2026-02-10",
      isComplex: false,
      conditions: [],
      labs: [],
      immunizations: [],
      medications: [],
      allergies: [],
      visits: [],
    },
  ],
  total: 2,
  page: 0,
};

const PATIENT_DETAIL_PAYLOAD = {
  id: "PAT-001",
  name: "Jane Doe",
  dob: "1967-04-12",
  age: 58,
  gender: "F",
  race: "White",
  ethnicity: "Not Hispanic or Latino",
  language: "English",
  maritalStatus: "Married",
  insuranceType: "Medicare Advantage",
  conditions: [
    {
      code: "E11.9",
      display: "Type 2 diabetes mellitus without complications",
      onset: "2018-06-14",
    },
  ],
  labs: [
    {
      name: "A1C",
      value: 8.4,
      unit: "%",
      flag: "High",
      date: "2026-02-24",
    },
    {
      name: "Creatinine",
      value: 1.1,
      unit: "mg/dL",
      flag: "Normal",
      date: "2026-02-24",
    },
  ],
  immunizations: [
    {
      name: "Influenza, seasonal",
      cvx: "140",
      date: "2025-10-18",
    },
  ],
  medications: [
    {
      name: "Metformin",
      dose: "1000 mg",
      frequency: "BID",
      route: "PO",
      status: "Active",
      started: "2018-06-14",
    },
  ],
  allergies: [
    {
      allergen: "Penicillin",
      reaction: "Hives",
      severity: "Moderate",
    },
  ],
  visits: [
    {
      date: "2026-02-25",
      type: "Office Visit",
      provider: "Dr. Shah",
      chiefComplaint: "Diabetes follow-up",
      assessment: "A1C remains above goal.",
      plan: "Increase monitoring and reinforce adherence.",
      vitals: {
        bp: "138/82",
        hr: 76,
        rr: 16,
        spo2: 98,
        temp: "98.4 F",
        weight: "172 lb",
      },
      notes: "Discussed diet, exercise, and medication adherence.",
    },
  ],
  imagingReports: [
    {
      date: "2025-12-02",
      modality: "XR",
      bodyPart: "Chest",
      findings: "No acute cardiopulmonary abnormality.",
      impression: "Stable chest radiograph.",
      orderingProvider: "Dr. Shah",
    },
  ],
  socialHistory: {
    smokingStatus: "Never",
    alcoholUse: "Occasional",
    exerciseFrequency: "3x weekly",
    occupation: "Teacher",
    livingSituation: "Lives with spouse",
  },
  clinicalNotes: [
    {
      date: "2026-02-25",
      author: "Dr. Shah",
      noteType: "Progress Note",
      content: "Patient motivated but struggling with consistency.",
    },
  ],
  lastVisit: "2026-02-25",
  isComplex: true,
};

const DASHBOARD_OVERVIEW_PAYLOAD = {
  team: {
    id: "team-demo",
    name: "Demo Team",
    joinCode: "REAL1234",
    role: "lead",
    memberCount: 3,
  },
  milestoneProgress: [],
  counts: {
    configs: 2,
    experiments: 1,
    notebookEntries: 2,
    practiceRuns: 1,
    checkpointRuns: 0,
    officialRuns: 0,
    reflections: 1,
  },
  recentRuns: [],
};

async function mockWorkspaceReady(page: Parameters<typeof test>[0]["page"]) {
  await mockApi(page, async (route, url) => {
    if (url.pathname === "/api/teams") {
      await fulfillJson(route, 200, TEAM_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/patients/PAT-001") {
      await fulfillJson(route, 200, PATIENT_DETAIL_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/patients") {
      await fulfillJson(route, 200, PATIENT_LIST_PAYLOAD);
      return;
    }

    await route.continue();
  });
}

async function mockSettingsReady(page: Parameters<typeof test>[0]["page"]) {
  await mockApi(page, async (route, url) => {
    if (url.pathname === "/api/teams" && url.searchParams.get("include") === "members") {
      await fulfillJson(route, 200, TEAM_SETTINGS_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/teams") {
      await fulfillJson(route, 200, TEAM_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/configs") {
      await fulfillJson(route, 200, CONFIGS_PAYLOAD);
      return;
    }

    await route.continue();
  });
}

async function mockDashboardReady(page: Parameters<typeof test>[0]["page"]) {
  await mockApi(page, async (route, url) => {
    if (url.pathname === "/api/teams") {
      await fulfillJson(route, 200, TEAM_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/project/overview") {
      await fulfillJson(route, 200, DASHBOARD_OVERVIEW_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/notebook") {
      if (route.request().method() === "GET") {
        await fulfillJson(route, 200, []);
        return;
      }
      await fulfillJson(route, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/reflections") {
      if (route.request().method() === "GET") {
        await fulfillJson(route, 200, []);
        return;
      }
      await fulfillJson(route, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/milestones") {
      await fulfillJson(route, 200, { ok: true });
      return;
    }

    await route.continue();
  });
}

async function mockPopulationHealthReady(
  page: Parameters<typeof test>[0]["page"]
) {
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
      await fulfillJson(route, 200, []);
      return;
    }

    await route.continue();
  });
}

test("workspace ready state supports patient selection and chart context", async ({
  page,
}) => {
  await mockWorkspaceReady(page);
  await signInAsDemo(page);
  const patientsResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().includes("/api/patients?")
  );
  await page.goto("/workspace");
  const patientsResponse = await patientsResponsePromise;
  const patientsJson = (await patientsResponse.json()) as {
    patients?: Array<{ name: string }>;
  };

  expect(patientsJson.patients?.map((patient) => patient.name)).toContain(
    "Jane Doe"
  );

  await expect(page.getByText("Demo Team", { exact: true })).toBeVisible();
  await expect(page.getByText("Code REAL1234", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /Jane Doe/ })).toBeVisible();

  await page.getByRole("button", { name: /Jane Doe/ }).click();

  await expect(page.getByText(/Reviewing:\s*Jane Doe/)).toBeVisible();
  await expect(page.getByText(/DOB:\s*1967-04-12/)).toBeVisible();
  await page.getByRole("button", { name: "Labs" }).click();
  await expect(page.getByText("A1C", { exact: true })).toBeVisible();
  await expect(page.getByText("8.4", { exact: false })).toBeVisible();
  await expect(page.getByText("Patient list unavailable", { exact: true })).toHaveCount(
    0
  );
});

test("settings ready state renders real team members and saved configs", async ({
  page,
}) => {
  await mockSettingsReady(page);
  await signInAsDemo(page);
  await page.goto("/settings");

  await expect(
    page.getByRole("heading", { name: "Settings", exact: true })
  ).toBeVisible();
  await expect(page.locator('input[readonly][value="Demo Team"]')).toBeVisible();
  await expect(page.getByText("Alex Rivera", { exact: true })).toBeVisible();
  await expect(page.getByText("Jordan Kim", { exact: true })).toBeVisible();
  await expect(page.getByText("Safety First", { exact: true })).toBeVisible();
  await expect(page.getByText("Fast Compare", { exact: true })).toBeVisible();
  await expect(page.getByText("Frozen", { exact: true })).toBeVisible();
  await expect(page.getByText("Editable", { exact: true })).toBeVisible();
  await expect(page.getByText("Settings unavailable", { exact: true })).toHaveCount(
    0
  );
  await expect(
    page.getByText("Join a team to use settings", { exact: true })
  ).toHaveCount(0);
});

test("experiments page clearly marks single-patient work and points cohort work to population health", async ({
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

  await expect(
    page.getByText("Single-Patient Comparison Runner", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(
      "Run the same single-patient task across 2-3 saved configs",
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    page
      .locator("main")
      .getByText("If you want to compare behavior across a cohort or group of")
  ).toBeVisible();
});

test("population health page exposes cohort work as a separate workflow", async ({
  page,
}) => {
  await mockPopulationHealthReady(page);
  await signInAsDemo(page);
  await page.goto("/population-health");

  await expect(
    page.getByRole("link", { name: "Population Health", exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(
      "Cohort-level tasks for outreach, care gaps, and risk stratification",
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    page
      .locator("main")
      .getByText("If you want to compare behavior on a single chart instead")
  ).toBeVisible();
});

test("population health note-review task shows measured accuracy against ground truth", async ({
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
      await fulfillJson(route, 200, []);
      return;
    }

    if (url.pathname === "/api/population/run") {
      await fulfillJson(route, 200, POPULATION_RUN_PAYLOAD);
      return;
    }

    await route.continue();
  });

  await signInAsDemo(page);
  await page.goto("/population-health");

  await page
    .locator("select")
    .first()
    .selectOption("sensitive-exam-documentation-audit");
  await expect(page.getByText("Note-review task", { exact: true })).toBeVisible();
  await expect(page.getByText("Accuracy measurement", { exact: true })).toBeVisible();
  const comparisonSlots = page
    .locator(".ehr-shell")
    .filter({ has: page.getByText("Comparison slots", { exact: true }) });
  await comparisonSlots.getByRole("button", { name: /Safety First/i }).click();
  await comparisonSlots.getByRole("button", { name: /Fast Compare/i }).click();
  await page.getByRole("button", { name: "Run Population Comparison" }).click();

  await expect(page.getByText("Accuracy Check", { exact: true })).toBeVisible();
  await expect(page.getByText("Precision", { exact: true })).toBeVisible();
  await expect(page.getByText("100%", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Sofia Alvarez, Mina Rahman", { exact: true })).toBeVisible();
});

test("experiments zero-config state offers starter presets", async ({
  page,
}) => {
  let starterPresetsCreated = false;

  await mockApi(page, async (route, url) => {
    if (url.pathname === "/api/teams") {
      await fulfillJson(route, 200, TEAM_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/configs" && route.request().method() === "GET") {
      await fulfillJson(route, 200, starterPresetsCreated ? CONFIGS_PAYLOAD : []);
      return;
    }

    if (url.pathname === "/api/configs/presets") {
      starterPresetsCreated = true;
      await fulfillJson(route, 200, {
        message: "Created 2 starter preset configurations.",
      });
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

  await expect(page.getByText("No saved configs yet", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create starter presets" }).click();
  await expect(
    page.getByText("Created 2 starter preset configurations.", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Safety First gemini-1\.5-pro/i })
  ).toBeVisible();
});

test("population health zero-config state offers starter presets", async ({
  page,
}) => {
  let starterPresetsCreated = false;

  await mockApi(page, async (route, url) => {
    if (url.pathname === "/api/teams") {
      await fulfillJson(route, 200, TEAM_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/configs" && route.request().method() === "GET") {
      await fulfillJson(route, 200, starterPresetsCreated ? CONFIGS_PAYLOAD : []);
      return;
    }

    if (url.pathname === "/api/configs/presets") {
      starterPresetsCreated = true;
      await fulfillJson(route, 200, {
        message: "Created 2 starter preset configurations.",
      });
      return;
    }

    if (url.pathname === "/api/population/cohorts") {
      await fulfillJson(route, 200, POPULATION_COHORTS_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/population/runs") {
      await fulfillJson(route, 200, []);
      return;
    }

    await route.continue();
  });

  await signInAsDemo(page);
  await page.goto("/population-health");

  await expect(page.getByText("No saved configs yet", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create starter presets" }).click();
  await expect(
    page.getByText("Created 2 starter preset configurations.", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Fast Compare", { exact: true })).toBeVisible();
});

test("create-team flow returns a shareable join code", async ({ page }) => {
  let createdTeam = false;
  let createdName = "";

  await mockApi(page, async (route, url) => {
    if (
      url.pathname === "/api/teams" &&
      url.searchParams.get("scope") === "current"
    ) {
      if (createdTeam) {
        await fulfillJson(route, 200, {
          ...TEAM_PAYLOAD,
          name: createdName,
          joinCode: "ZXCV1234",
        });
      } else {
        await fulfillJson(route, 404, NO_TEAM_PAYLOAD);
      }
      return;
    }

    if (url.pathname === "/api/teams" && route.request().method() === "POST") {
      const payload = route.request().postDataJSON() as { name?: string };
      createdTeam = true;
      createdName = payload.name ?? "Clinical Minds";
      await fulfillJson(route, 200, {
        id: "team-created",
        name: createdName,
        joinCode: "ZXCV1234",
        role: "lead",
      });
      return;
    }

    await route.continue();
  });

  await signInAsDemo(page);
  await page.goto("/join-team");
  await page.getByRole("button", { name: "Create a Team" }).click();
  await page.getByPlaceholder("e.g. Clinical Minds").fill("Clinical Minds");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(
    page.getByText("Team Created", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Clinical Minds", { exact: true })).toBeVisible();
  await expect(page.getByText("ZXCV1234", { exact: true })).toBeVisible();
});

test("join-team flow uppercases invite codes and lands on dashboard", async ({
  page,
}) => {
  let joinedTeam = false;
  let submittedJoinCode = "";

  await mockApi(page, async (route, url) => {
    if (
      url.pathname === "/api/teams" &&
      url.searchParams.get("scope") === "current"
    ) {
      if (joinedTeam) {
        await fulfillJson(route, 200, TEAM_PAYLOAD);
      } else {
        await fulfillJson(route, 404, NO_TEAM_PAYLOAD);
      }
      return;
    }

    if (url.pathname === "/api/teams/join") {
      const payload = route.request().postDataJSON() as { joinCode?: string };
      submittedJoinCode = payload.joinCode ?? "";
      joinedTeam = true;
      await fulfillJson(route, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/project/overview") {
      await fulfillJson(route, 200, DASHBOARD_OVERVIEW_PAYLOAD);
      return;
    }

    if (url.pathname === "/api/notebook" || url.pathname === "/api/reflections") {
      await fulfillJson(route, 200, []);
      return;
    }

    await route.continue();
  });

  await signInAsDemo(page);
  await page.goto("/join-team");
  await page.getByRole("button", { name: "Join a Team" }).click();
  await page.getByPlaceholder("e.g. ABCD1234").fill("abcd1234");
  await page.getByRole("button", { name: "Join" }).click();

  await page.waitForURL("**/dashboard");
  expect(submittedJoinCode).toBe("ABCD1234");
  await expect(
    page.getByRole("banner").getByText("Demo Team", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "ChatEHR Main Project", exact: true })
  ).toBeVisible();
});
