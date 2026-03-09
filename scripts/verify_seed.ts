import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { expectedSeedCounts } from "./data/teaching-content";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error("Missing .env.local in project root.");
  }

  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(url, key);
  const checks = await Promise.all([
    supabase.from("guideline_chunks").select("id", { count: "exact", head: true }),
    supabase.from("benchmark_cases").select("id", { count: "exact", head: true }),
    supabase
      .from("benchmark_cases")
      .select("id", { count: "exact", head: true })
      .eq("pack_id", "practice"),
    supabase
      .from("benchmark_cases")
      .select("id", { count: "exact", head: true })
      .eq("pack_id", "checkpoint"),
    supabase
      .from("benchmark_cases")
      .select("id", { count: "exact", head: true })
      .eq("pack_id", "final"),
    supabase
      .from("benchmark_cases")
      .select("id", { count: "exact", head: true })
      .eq("category", "bias_equity"),
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .like("id", "PT-TCH-%"),
  ]);

  const summary = {
    guidelineChunks: checks[0].count ?? 0,
    benchmarkCases: checks[1].count ?? 0,
    practiceCases: checks[2].count ?? 0,
    checkpointCases: checks[3].count ?? 0,
    finalCases: checks[4].count ?? 0,
    fairnessCases: checks[5].count ?? 0,
    teachingPatients: checks[6].count ?? 0,
  };

  console.log("Seed verification");
  console.log(summary);

  const failures = [
    summary.guidelineChunks !== expectedSeedCounts.guidelineChunkCount &&
      `Expected ${expectedSeedCounts.guidelineChunkCount} guideline chunks`,
    summary.benchmarkCases !== expectedSeedCounts.benchmarkCaseCount &&
      `Expected ${expectedSeedCounts.benchmarkCaseCount} benchmark cases`,
    summary.practiceCases !== expectedSeedCounts.benchmarkPackCounts.practice &&
      `Expected ${expectedSeedCounts.benchmarkPackCounts.practice} practice cases`,
    summary.checkpointCases !== expectedSeedCounts.benchmarkPackCounts.checkpoint &&
      `Expected ${expectedSeedCounts.benchmarkPackCounts.checkpoint} checkpoint cases`,
    summary.finalCases !== expectedSeedCounts.benchmarkPackCounts.final &&
      `Expected ${expectedSeedCounts.benchmarkPackCounts.final} final cases`,
    summary.fairnessCases !== expectedSeedCounts.fairnessCaseCount &&
      `Expected ${expectedSeedCounts.fairnessCaseCount} fairness cases`,
    summary.teachingPatients !== expectedSeedCounts.teachingPatientCount &&
      `Expected ${expectedSeedCounts.teachingPatientCount} teaching patients`,
  ].filter(Boolean);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Seed verification failed:", error);
  process.exit(1);
});
