import { expect, test } from "@playwright/test";
import { completeA1, openTab, REFLECTION, signIn, submitAssignment, testEmail } from "./helpers";

test("instructor grades with a rubric, returns for revision, and exports CSV", async ({ browser }) => {
  const studentEmail = testEmail("grading-student");
  const instructorEmail = testEmail("grading-instructor");

  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await signIn(student, studentEmail);
  await completeA1(student);
  await submitAssignment(student, "FORDMS-A1", REFLECTION);

  const instructorContext = await browser.newContext();
  const instructor = await instructorContext.newPage();
  await signIn(instructor, instructorEmail, "instructor");
  await openTab(instructor, "Gradebook");
  await instructor.getByLabel("Show test accounts").check();
  await instructor.getByLabel("Search").fill(studentEmail);
  await instructor.locator(".roster-table tbody tr", { hasText: studentEmail }).first().click();
  await expect(instructor.getByRole("heading", { name: "Student submission" })).toBeVisible();
  await expect(instructor.locator(".student-response")).toContainText("date of birth");
  const points = [28, 22, 18, 15, 9];
  for (let index = 0; index < points.length; index += 1) await instructor.locator(".rubric-table input[type=number]").nth(index).fill(String(points[index]));
  await expect(instructor.locator(".grade-total")).toContainText("92/100");
  await instructor.getByLabel("Feedback to the student (10+ characters)").fill("Strong identity reasoning. Say more about why the conflict rule uses provider, date, and time.");
  await instructor.getByRole("button", { name: "Save and release grade" }).click();
  await expect(instructor.locator(".form-message.success")).toContainText("Grade 92/100");
  await expect(instructor.locator(".grade-events")).toContainText("graded");

  await instructor.getByLabel("Return for revision (comment shown to the student)").fill("Please expand the coding explanation and resubmit.");
  await instructor.getByRole("button", { name: "Return for revision" }).click();
  await expect(instructor.locator(".form-message.success")).toContainText("Returned for revision");

  await student.reload();
  await openTab(student, "Assignments");
  await expect(student.locator(".return-card")).toContainText("expand the coding explanation");
  await submitAssignment(student, "FORDMS-A1", `${REFLECTION} In addition, the CPT code describes the office visit level while the ICD-10-CM code describes the shoulder condition that justified it.`);
  await expect(student.locator(".assignment-header")).toContainText("Submitted v2");

  await instructor.reload();
  await openTab(instructor, "Gradebook");
  await instructor.getByLabel("Show test accounts").check();
  await instructor.getByLabel("Search").fill(studentEmail);
  await instructor.locator(".roster-table tbody tr", { hasText: studentEmail }).first().click();
  await expect(instructor.locator(".version-list")).toContainText("Version 2");
  await expect(instructor.locator(".version-list")).toContainText("Version 1");

  const csv = await instructor.request.get("/api/instructor/export?format=blackboard&assignment=all&scale=rubric&includeTest=1");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const text = await csv.text();
  expect(text).toContain('"Last Name","First Name","Username","FordMS A1 Identity and access [Total Pts: 100 Score]"');
  expect(text).toContain(studentEmail.split("@")[0]);

  await studentContext.close();
  await instructorContext.close();
});
