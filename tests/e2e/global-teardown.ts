import { spawnSync } from "node:child_process";

export default async function globalTeardown() {
  if (process.env.FORDMS_E2E_KEEP_USERS === "1") return;
  const result = spawnSync(process.execPath, ["scripts/cleanup_test_users.mjs"], { stdio: "inherit", env: process.env });
  if (result.status !== 0) console.warn("[e2e] test-user cleanup exited with", result.status);
}
