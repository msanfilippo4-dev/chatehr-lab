/**
 * Render the assignment guides as Markdown for docs/ASSIGNMENT_GUIDES.md, so the
 * document and the in-app guide always carry the same text (a unit test compares them).
 */
import type { CourseAssignment } from "./config/types";
import { hrefFor, roleFromSlug, viewFromSlug } from "./navigation";

export const PRODUCTION_ORIGIN = "https://fordms.com";

function link(label: string, target: { view: string; patient?: string; role?: string; tab?: string }): string {
  const view = viewFromSlug(target.view) ?? target.view;
  const href = hrefFor({ view, patient: target.patient, role: roleFromSlug(target.role), tab: target.tab });
  return `[${label}](${PRODUCTION_ORIGIN}${href})`;
}

export function assignmentGuideMarkdown(assignments: CourseAssignment[]): string {
  const lines: string[] = [
    "# FordMS assignment guides",
    "",
    "Student-facing guides for FORDMS-A1 to A4, identical to the step-by-step guide in the FordMS Assignments view.",
    "In the app, steps with a check mark tick off automatically when the audit trail records the action.",
    "Links open the right screen, simulated role, and patient.",
    "",
    "You are the clinical informatics analyst at Fordham Health. Your manager is Dana Okafor, the clinical informatics manager.",
    "All patients, staff, and data are fictional. FordMS is a teaching simulation, not a clinical system.",
    "",
  ];
  for (const assignment of assignments) {
    const code = assignment.id.replace("FORDMS-", "");
    lines.push(`## ${code}: ${assignment.title}`, "");
    lines.push(`**Due:** ${assignment.dueLabel} · **Time:** about ${assignment.estimatedMinutes} minutes · **Assignment id:** ${assignment.id}`, "");
    if (!assignment.guide) {
      lines.push(assignment.scenario, "");
      continue;
    }
    lines.push("### Your situation", "", assignment.guide.situation, "");
    assignment.guide.parts.forEach((part, index) => {
      lines.push(`### Part ${index + 1}: ${part.title} (about ${part.minutes} min)`, "");
      part.steps.forEach((step, stepIndex) => {
        lines.push(`${stepIndex + 1}. ${step.text}${step.check ? " ✓ *(checked automatically)*" : ""}`);
        if (step.link) lines.push(`   - Link: ${link(step.link.label, step.link)}`);
        if (step.expect) lines.push(`   - You should see: ${step.expect}`);
      });
      lines.push("");
      if (part.tip) lines.push(`> **Analyst tip:** ${part.tip}`, "");
    });
    lines.push("### What the app checks", "");
    for (const requirement of assignment.requirements) {
      lines.push(`- ${requirement.label}${requirement.minimumCount > 1 ? ` (${requirement.minimumCount} needed)` : ""}`);
    }
    lines.push("", "### Written analysis", "", assignment.submissionPrompt, "");
    lines.push("### Rubric (100 points)", "", "| Criterion | Points | Standard |", "| --- | --- | --- |");
    for (const item of assignment.rubric) lines.push(`| ${item.criterion} | ${item.points} | ${item.standard} |`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
