import { readFile } from "node:fs/promises";
import path from "node:path";

type QueryRow = Record<string, unknown>;

function resolveProjectRef() {
  const explicitRef = process.env.SUPABASE_PROJECT_REF?.trim();
  if (explicitRef) return explicitRef;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;

  try {
    return new URL(url).hostname.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function runSql<T extends QueryRow = QueryRow>(
  projectRef: string,
  accessToken: string,
  query: string,
  readOnly = false
) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(readOnly ? { query, read_only: true } : { query }),
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `SQL API request failed (${response.status} ${response.statusText}): ${text}`
    );
  }

  return text ? (JSON.parse(text) as T[]) : [];
}

async function applyMigration(
  projectRef: string,
  accessToken: string,
  relativePath: string
) {
  const absolutePath = path.join(process.cwd(), relativePath);
  const sql = await readFile(absolutePath, "utf8");
  console.log(`Applying ${relativePath}...`);
  await runSql(projectRef, accessToken, sql, false);
  console.log(`Applied ${relativePath}`);
}

function extractVersionFromPath(relativePath: string) {
  const match = path.basename(relativePath).match(/^([0-9]+)_/);
  if (!match) {
    throw new Error(`Could not extract migration version from ${relativePath}`);
  }
  return match[1];
}

async function repairMigrationHistory(
  projectRef: string,
  accessToken: string,
  versions: string[]
) {
  if (!versions.length) return;

  const values = versions.map((version) => `('${version}')`).join(", ");
  await runSql(
    projectRef,
    accessToken,
    `
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text not null primary key
      );
      create table if not exists supabase_migrations.seed_files (
        path text not null primary key,
        hash text not null
      );
      insert into supabase_migrations.schema_migrations (version)
      values ${values}
      on conflict (version) do nothing;
    `,
    false
  );

  console.log(
    `Repaired migration history for versions: ${versions.join(", ")}`
  );
}

async function main() {
  const projectRef = resolveProjectRef();
  if (!projectRef) {
    throw new Error(
      "Missing project ref. Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL."
    );
  }

  const accessToken =
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    process.env.SUPABASE_PERSONAL_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    throw new Error(
      "Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PERSONAL_ACCESS_TOKEN."
    );
  }

  requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const preflight = await runSql<{ ok: number }>(
    projectRef,
    accessToken,
    "select 1 as ok;",
    true
  );
  console.log(`Connected to live project ${projectRef}. Preflight result: ${preflight[0]?.ok}`);

  const bootstrapCheck = await runSql<{ configurations_exists: boolean }>(
    projectRef,
    accessToken,
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'configurations'
      ) as configurations_exists;
    `,
    true
  );

  const shouldBootstrap = !bootstrapCheck[0]?.configurations_exists;
  const migrations = shouldBootstrap
    ? [
        "supabase/migrations/001_initial_schema.sql",
        "supabase/migrations/002_rls_policies.sql",
        "supabase/migrations/003_functions.sql",
        "supabase/migrations/004_realtime.sql",
        "supabase/migrations/005_course_product_upgrade.sql",
        "supabase/migrations/006_course_product_rls_and_functions.sql",
      ]
    : [
        "supabase/migrations/005_course_product_upgrade.sql",
        "supabase/migrations/006_course_product_rls_and_functions.sql",
      ];

  console.log(
    shouldBootstrap
      ? "Live project has no base schema. Bootstrapping 001-006."
      : "Live project has the base schema. Applying 005-006 only."
  );

  for (const migrationPath of migrations) {
    await applyMigration(projectRef, accessToken, migrationPath);
  }

  const repairVersions = (
    process.env.MIGRATION_REPAIR_VERSIONS?.split(",") ??
    migrations.map(extractVersionFromPath)
  )
    .map((version) => version.trim())
    .filter(Boolean);

  await repairMigrationHistory(projectRef, accessToken, repairVersions);

  const verification = await runSql<{
    course_settings_exists: boolean;
    experiment_runs_exists: boolean;
    notebook_entries_exists: boolean;
    reflection_submissions_exists: boolean;
    milestone_status_exists: boolean;
    team_observability_snapshots_exists: boolean;
    instructor_flags_exists: boolean;
    bias_equity_column_exists: boolean;
  }>(
    projectRef,
    accessToken,
    `
      select
        exists (
          select 1
          from information_schema.tables
          where table_schema = 'public' and table_name = 'course_settings'
        ) as course_settings_exists,
        exists (
          select 1
          from information_schema.tables
          where table_schema = 'public' and table_name = 'experiment_runs'
        ) as experiment_runs_exists,
        exists (
          select 1
          from information_schema.tables
          where table_schema = 'public' and table_name = 'notebook_entries'
        ) as notebook_entries_exists,
        exists (
          select 1
          from information_schema.tables
          where table_schema = 'public' and table_name = 'reflection_submissions'
        ) as reflection_submissions_exists,
        exists (
          select 1
          from information_schema.tables
          where table_schema = 'public' and table_name = 'milestone_status'
        ) as milestone_status_exists,
        exists (
          select 1
          from information_schema.tables
          where table_schema = 'public' and table_name = 'team_observability_snapshots'
        ) as team_observability_snapshots_exists,
        exists (
          select 1
          from information_schema.tables
          where table_schema = 'public' and table_name = 'instructor_flags'
        ) as instructor_flags_exists,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'benchmark_runs'
            and column_name = 'bias_equity_score'
        ) as bias_equity_column_exists;
    `,
    true
  );

  console.log("Verification:", JSON.stringify(verification[0], null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
