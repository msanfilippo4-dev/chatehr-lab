import { existsSync } from "node:fs";
import { createAdminClient } from "../lib/supabase/admin.ts";

function loadLocalEnv() {
  for (const candidate of [".env.local", ".env"]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
    }
  }
}

async function main() {
  loadLocalEnv();

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("reconcile_stale_benchmark_runs");

  if (error) {
    throw error;
  }

  console.log(
    JSON.stringify(
      {
        reconciledCount: data ?? 0,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
