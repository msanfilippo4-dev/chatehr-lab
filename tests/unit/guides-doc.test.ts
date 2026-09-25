import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultAssignments } from "@/lib/assignments";
import { assignmentGuideMarkdown } from "@/lib/guide-markdown";

const DOC = join(__dirname, "../../docs/ASSIGNMENT_GUIDES.md");

describe("docs/ASSIGNMENT_GUIDES.md", () => {
  it("matches the in-app guide text (regenerate with WRITE_GUIDES=1 npx vitest run tests/unit/guides-doc.test.ts)", () => {
    const markdown = assignmentGuideMarkdown(defaultAssignments);
    if (process.env.WRITE_GUIDES === "1" || !existsSync(DOC)) writeFileSync(DOC, markdown);
    expect(readFileSync(DOC, "utf8")).toBe(markdown);
  });
});
