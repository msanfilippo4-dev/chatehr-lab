import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { routeErrorResponse } from "@/lib/api-response";
import { loadInstructorTeamDetail } from "@/lib/instructor-data";
import { requireInstructor } from "@/lib/server-context";
import { toCsv } from "@/lib/csv";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "--";
  return new Date(value).toLocaleString();
}

function formatScore(value: unknown) {
  return typeof value === "number" ? value.toFixed(1) : "--";
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  try {
    await requireInstructor(supabase, session);
  } catch (error) {
    return routeErrorResponse(error, "Failed to export team report.");
  }

  let detail;
  try {
    detail = await loadInstructorTeamDetail(supabase, params.id);
  } catch (error) {
    return routeErrorResponse(error, "Failed to export team report.");
  }
  const gradeTotal = detail.grade
    ? detail.grade.experimental_design +
      detail.grade.benchmark_evidence +
      detail.grade.cost_observability +
      detail.grade.safety_reasoning +
      detail.grade.bias_equity +
      detail.grade.final_recommendation
    : null;
  const format = new URL(req.url).searchParams.get("format");
  const slug = detail.team.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  if (format === "csv") {
    const csv = toCsv([
      {
        section: "team",
        teamName: detail.team.name,
        joinCode: detail.team.join_code,
        createdAt: detail.team.created_at,
        gradeTotal: gradeTotal ?? "",
      },
      ...detail.members.map((member) => ({
        section: "member",
        teamName: detail.team.name,
        memberName: member.name,
        memberEmail: member.email,
        memberRole: member.role,
        platformRole: member.platformRole,
      })),
      ...detail.runs.map((run) => ({
        section: "benchmark_run",
        teamName: detail.team.name,
        runMode: run.runMode,
        packId: run.packId ?? "",
        configName: run.configName,
        modelName: run.modelName,
        tournamentScore: run.tournamentScore ?? "",
        accuracyScore: run.accuracyScore ?? "",
        safetyScore: run.safetyScore ?? "",
        biasEquityScore: run.biasEquityScore ?? "",
        evaluationCostUsd: run.evaluationCostUsd ?? "",
        completedAt: run.completedAt ?? run.createdAt,
      })),
      ...detail.populationRuns.map((run) => ({
        section: "population_run",
        teamName: detail.team.name,
        cohortName: run.cohort_name,
        taskTitle: run.task_title,
        createdAt: run.created_at,
      })),
      ...detail.flags.map((flag) => ({
        section: "flag",
        teamName: detail.team.name,
        flagType: flag.flag_type,
        severity: flag.severity,
        summary: flag.summary,
        createdAt: flag.created_at,
      })),
      ...detail.notebookEntries.slice(0, 20).map((entry) => ({
        section: "notebook_entry",
        teamName: detail.team.name,
        category: entry.category,
        title: entry.title,
        content: entry.content,
        createdAt: entry.created_at,
      })),
    ]);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-instructor-report.csv"`,
      },
    });
  }

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(detail.team.name)} instructor report</title>
    <style>
      body { font-family: Georgia, serif; margin: 40px; color: #1f2937; }
      h1, h2, h3 { color: #8c1515; margin-bottom: 8px; }
      h1 { font-size: 28px; }
      h2 { font-size: 18px; margin-top: 28px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
      p, li, td, th { font-size: 13px; line-height: 1.45; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; text-align: left; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .card { border: 1px solid #d1d5db; padding: 12px; border-radius: 8px; }
      .muted { color: #6b7280; }
      ul { padding-left: 18px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(detail.team.name)} Instructor Report</h1>
    <p class="muted">Generated ${escapeHtml(formatDate(new Date().toISOString()))}</p>

    <div class="grid">
      <div class="card">
        <strong>Join code</strong>
        <p>${escapeHtml(detail.team.join_code)}</p>
      </div>
      <div class="card">
        <strong>Members</strong>
        <p>${detail.members.length}</p>
      </div>
      <div class="card">
        <strong>Grade total</strong>
        <p>${gradeTotal ?? "--"} / 100</p>
      </div>
    </div>

    <h2>Team Members</h2>
    <ul>${detail.members
      .map(
        (member) =>
          `<li>${escapeHtml(member.name)} (${escapeHtml(member.email)}) - ${escapeHtml(member.role)}</li>`
      )
      .join("")}</ul>

    <h2>Benchmark Runs</h2>
    <table>
      <thead>
        <tr>
          <th>Mode</th>
          <th>Config</th>
          <th>Tournament</th>
          <th>Safety</th>
          <th>Bias / Equity</th>
          <th>Completed</th>
        </tr>
      </thead>
      <tbody>${detail.runs
        .map(
          (run) => `<tr>
            <td>${escapeHtml(run.runMode)}</td>
            <td>${escapeHtml(run.configName)}<br /><span class="muted">${escapeHtml(run.modelName)}</span></td>
            <td>${formatScore(run.tournamentScore)}</td>
            <td>${formatScore(run.safetyScore)}</td>
            <td>${formatScore(run.biasEquityScore)}</td>
            <td>${escapeHtml(formatDate(run.completedAt ?? run.createdAt))}</td>
          </tr>`
        )
        .join("")}</tbody>
    </table>

    <h2>Notebook Highlights</h2>
    <ul>${detail.notebookEntries
      .slice(0, 8)
      .map(
        (entry) =>
          `<li><strong>${escapeHtml(entry.title)}</strong> - ${escapeHtml(entry.category)}<br />${escapeHtml(entry.content.slice(0, 280))}</li>`
      )
      .join("")}</ul>

    <h2>Reflection</h2>
    ${
      detail.reflection
        ? `<p><strong>${escapeHtml(detail.reflection.title)}</strong></p>
           <p>${escapeHtml(detail.reflection.summary)}</p>
           <p><strong>Benchmark evidence:</strong> ${escapeHtml(detail.reflection.benchmark_evidence)}</p>
           <p><strong>Cost and observability:</strong> ${escapeHtml(detail.reflection.cost_observability)}</p>
           <p><strong>Bias / equity risk:</strong> ${escapeHtml(detail.reflection.bias_equity_risk)}</p>
           <p><strong>Safety control:</strong> ${escapeHtml(detail.reflection.safety_control)}</p>
           <p><strong>Deployment recommendation:</strong> ${escapeHtml(detail.reflection.deployment_recommendation)}</p>`
        : `<p class="muted">No reflection submitted.</p>`
    }

    <h2>Rubric</h2>
    <table>
      <thead>
        <tr>
          <th>Experimental design</th>
          <th>Benchmark evidence</th>
          <th>Cost / observability</th>
          <th>Safety reasoning</th>
          <th>Bias / equity</th>
          <th>Final recommendation</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${detail.grade?.experimental_design ?? "--"} / 25</td>
          <td>${detail.grade?.benchmark_evidence ?? "--"} / 20</td>
          <td>${detail.grade?.cost_observability ?? "--"} / 15</td>
          <td>${detail.grade?.safety_reasoning ?? "--"} / 15</td>
          <td>${detail.grade?.bias_equity ?? "--"} / 15</td>
          <td>${detail.grade?.final_recommendation ?? "--"} / 10</td>
        </tr>
      </tbody>
    </table>
    <p><strong>Instructor comments:</strong> ${escapeHtml(detail.grade?.overall_comments ?? "No comments yet.")}</p>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-instructor-report.html"`,
    },
  });
}
