// @vitest-environment jsdom
import { act, createElement, useReducer } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Tickets } from "@/components/views/Tickets";
import { Assignments } from "@/components/views/Assignments";
import { defaultAssignments } from "@/lib/assignments";
import { defaultCourseConfig } from "@/lib/config/defaults";
import { normalizeState } from "@/lib/db";
import { buildInitialState } from "@/lib/seed";
import { ehrReducer, type WorkspaceAction } from "@/lib/store/reducer";
import type { CourseSubmission, EHRState } from "@/lib/types";

const mocks = vi.hoisted(() => ({ post: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/api", () => ({ postJson: mocks.post }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const meta = { at: "2026-11-08T12:00:00Z", actor: "student@fordham.edu", role: "Analyst" as const, makeId: (prefix: string) => `${prefix}-${Math.random()}` };
let container: HTMLDivElement;
let root: Root;
let current: EHRState;

beforeEach(() => { vi.resetAllMocks(); container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(() => root.unmount()); container.remove(); });

async function mount(initial: EHRState, view: "tickets" | "assignments" = "tickets", submissions: CourseSubmission[] = []) {
  function Harness() {
    const [state, dispatch] = useReducer((state: EHRState, action: WorkspaceAction) => ehrReducer(state, action, meta), initial);
    current = state;
    if (view === "assignments") return createElement(Assignments, {
      state, dispatch, readOnly: false, navigate: vi.fn(), exportLearnerReport: vi.fn(), refreshCourseData: mocks.refresh, flushSync: vi.fn(), replaceWorkspace: vi.fn(),
      courseData: { user: { email: meta.actor, role: "student" }, assignments: defaultAssignments, config: defaultCourseConfig, configVersion: 1, releases: [], workspace: state, workspaceUpdatedAt: meta.at, resetMarkers: {}, progress: [], submissions },
    });
    return createElement(Tickets, { state, dispatch, config: defaultCourseConfig, patient: state.patients[0], role: "Analyst", selectPatient: vi.fn(), setView: vi.fn(), makeId: meta.makeId, readOnly: false, navigate: vi.fn() });
  }
  await act(() => root.render(createElement(Harness)));
}

async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.trim().startsWith(text));
  expect(button, text).toBeTruthy();
  await act(() => button!.click());
}

function field(label: string) {
  return container.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
}

async function fill(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, text: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(() => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, text);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

function completedTicket() {
  let state = buildInitialState(undefined, meta.actor);
  const ticket = state.tickets[0];
  state = ehrReducer(state, { type: "triageTicket", ticketId: ticket.id, category: "Safety", priority: "High", owner: "Me (clinical informatics analyst)" }, meta);
  state = ehrReducer(state, { type: "recordTicketEvidence", ticketId: ticket.id, evidenceId: "E1", note: "Previously saved evidence note." }, meta);
  return ehrReducer(state, { type: "resolveTicket", ticketId: ticket.id, resolution: { rootCause: ticket.rootCauseOptions[1], detail: "The saved root cause is supported by the evidence.", fix: "Correct the upstream process and monitor recurrence.", notify: [ticket.notifyOptions[0]], communication: "Thank you for reporting this. We have identified the cause and will follow up." } }, meta);
}

describe("saved ticket work", () => {
  it("shows a resolved ticket and its legacy note after switching, and saves a note without extra evidence", async () => {
    await mount(completedTicket());
    await click("TKT-1042");
    await click("TKT-1041");
    expect(field("Evidence note").value).toBe("Previously saved evidence note.");
    expect(container.querySelector(".resolution-card")?.textContent).toContain("The saved root cause");
    await fill(field("Evidence note"), "Updated explanation using the same evidence.");
    await click("Save evidence");
    expect(current.tickets[0].evidence.map((item) => item.id)).toEqual(["E1"]);
    await click("TKT-1042");
    await click("TKT-1041");
    expect(field("Evidence note").value).toBe("Updated explanation using the same evidence.");
    expect(current.tickets[0].status).toBe("Resolved");
  });

  it("lets a learner correct saved evidence without losing the resolution", async () => {
    let state = completedTicket();
    state = ehrReducer(state, { type: "recordTicketEvidence", ticketId: "TKT-1041", evidenceId: "E4", note: "" }, meta);
    await mount(state);
    const savedCheckbox = container.querySelectorAll<HTMLInputElement>('[aria-label="Evidence"] input')[3];
    expect(savedCheckbox.disabled).toBe(false);
    await act(() => savedCheckbox.click());
    await click("Save evidence");
    expect(current.tickets[0].evidence.map((item) => item.id)).toEqual(["E1"]);
    expect(current.tickets[0].resolution).toEqual(state.tickets[0].resolution);
    expect(current.audit[0].detail).toContain("removed E4");
  });

  it("preserves resolution drafts across navigation and restoration without completing another ticket", async () => {
    await mount(completedTicket());
    await click("Reopen for edit");
    await fill(field("Root cause detail"), "Revised root cause detail kept as a draft.");
    await click("TKT-1042");
    await click("TKT-1041");
    expect(field("Root cause detail").value).toBe("Revised root cause detail kept as a draft.");
    expect(current.tickets[0].resolution?.detail).toBe("The saved root cause is supported by the evidence.");
    expect(current.tickets[1].status).toBe("New");
    const restored = normalizeState(JSON.parse(JSON.stringify(current)), meta.actor);
    await act(() => root.unmount());
    root = createRoot(container);
    await mount(restored);
    expect(field("Root cause detail").value).toBe("Revised root cause detail kept as a draft.");
    await click("Resolve ticket");
    expect(current.tickets[0].resolution?.detail).toBe("Revised root cause detail kept as a draft.");
    expect(current.tickets[0].draft?.resolution).toBeUndefined();
  });
});

describe("assignment receipts and drafts", () => {
  it("keeps a successful submission confirmation when refreshing its receipt fails", async () => {
    const state = buildInitialState(undefined, meta.actor);
    const assignment = defaultAssignments.find((item) => item.id === "FORDMS-A2")!;
    state.audit = assignment.requirements.flatMap((requirement, index) => Array.from({ length: requirement.minimumCount }, (_, item) => ({
      id: `test-${index}-${item}`, timestamp: meta.at, actor: meta.actor, action: requirement.action,
      detail: requirement.detailMatch ?? "Completed for this test", context: `${requirement.contextMatch ?? ""}test-${index}-${item}`, provenance: "earned" as const,
    })));
    state.assignmentDrafts = { "FORDMS-A2": "This saved analysis supports the required workflow and explains the evidence, the recommended correction, the medication decision, and how the result follow-up closes the loop." };
    mocks.post.mockResolvedValue({ version: 1, late: false, importedUnits: 0 });
    mocks.refresh.mockRejectedValue(new Error("Connection lost while refreshing"));
    await mount(state, "assignments");
    await click("A2");
    await click("Submit assignment");
    expect(mocks.post).toHaveBeenCalledOnce();
    expect(container.querySelector(".form-message.success")?.textContent).toContain("you do not need to resubmit");
    expect(container.querySelector(".form-message.error")).toBeNull();
  });

  it("shows the saved text and word count while keeping subsequent drafts separate across navigation and restoration", async () => {
    const submission: CourseSubmission = { assignment_id: "FORDMS-A2", reflection: "Saved analysis.\n\nSecond paragraph.", version: 1, status: "submitted", score: null, rubric_total: null, feedback: null, submitted_at: meta.at, graded_at: null };
    await mount(buildInitialState(undefined, meta.actor), "assignments", [submission]);
    await click("A2");
    const receipt = () => container.querySelector('[aria-label="Submission receipt"]')!;
    expect(receipt().textContent).toContain("4 words");
    expect(receipt().textContent).toContain(submission.reflection);
    expect(container.textContent).toContain("Time spent does not affect your grade");
    const analysis = () => container.querySelector<HTMLTextAreaElement>("textarea")!;
    expect(analysis().value).toBe(submission.reflection);
    await fill(analysis(), "My unsubmitted revision remains a separate draft.");
    await click("A1");
    expect(analysis().value).toBe("");
    await click("A2");
    expect(analysis().value).toBe("My unsubmitted revision remains a separate draft.");
    expect(receipt().textContent).toContain(submission.reflection);
    const restored = normalizeState(JSON.parse(JSON.stringify(current)), meta.actor);
    await act(() => root.unmount());
    root = createRoot(container);
    await mount(restored, "assignments", [submission]);
    await click("A2");
    expect(analysis().value).toBe("My unsubmitted revision remains a separate draft.");
    expect(receipt().textContent).toContain("4 words");
  });
});
