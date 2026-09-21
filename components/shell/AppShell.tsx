"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { signOut, useSession } from "next-auth/react";
import "@/app/accessibility.css";
import "@/app/advanced.css";
import "@/app/views.css";
import "@/app/instructor.css";
import "@/app/admin.css";
import { ConfirmDialog, Panel, SimulationBadge } from "@/components/ui/primitives";
import { Gradebook } from "@/components/instructor/Gradebook";
import { AdminConsole } from "@/components/admin/AdminConsole";
import { AIReview } from "@/components/views/AIReview";
import { Analytics } from "@/components/views/Analytics";
import { Assignments } from "@/components/views/Assignments";
import { AuditReview } from "@/components/views/AuditReview";
import { Encounter } from "@/components/views/Encounter";
import { HIEReconciliation } from "@/components/views/HIEReconciliation";
import { ImplementationReadiness } from "@/components/views/ImplementationReadiness";
import { MPIWorkbench } from "@/components/views/MPIWorkbench";
import { OrdersResults } from "@/components/views/OrdersResults";
import { Patients } from "@/components/views/Patients";
import { Portal } from "@/components/views/Portal";
import { QueryStudio } from "@/components/views/QueryStudio";
import { Registration } from "@/components/views/Registration";
import { Schedule } from "@/components/views/Schedule";
import { Worklist } from "@/components/views/Worklist";
import { download, type ViewProps } from "@/components/views/shared";
import { useCourseData } from "@/hooks/useCourseData";
import { makeId, useWorkspace } from "@/hooks/useWorkspace";
import { postJson } from "@/lib/api";
import { defaultCourseConfig, VIEW_NAMES, type View } from "@/lib/config/defaults";
import { exportEnvelope, importEnvelope } from "@/lib/db";
import { computeProgress, toProgressEvent } from "@/lib/progress";
import { fullReset } from "@/lib/store/reset";
import type { EHRState, ProgressRow, Role } from "@/lib/types";
import { PatientBanner } from "./PatientBanner";
import { TopBar } from "./TopBar";

const roles: Role[] = ["Front Desk", "Clinical", "HIM", "Patient", "Analyst", "Implementation Lead"];
const PATIENT_VIEWS = new Set<View>(["Worklist", "Schedule", "Registration", "Patients", "MPI", "Encounter", "Orders & Results", "Portal", "HIE", "AI Review", "Audit Review"]);
const defaultViewForRole: Record<Role, View> = { "Front Desk": "Schedule", Clinical: "Worklist", HIM: "MPI", Patient: "Portal", Analyst: "Query Studio", "Implementation Lead": "Implementation" };

export interface PreviewTarget { email: string; name: string; workspace: EHRState | null; progress: ProgressRow[]; submissions: unknown[] }

export function AppShell() {
  const { data: session, status: sessionStatus } = useSession();
  const { courseData, refresh, mergeProgress, error: courseError } = useCourseData();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [role, setRole] = useState<Role>("Clinical");
  const [view, setView] = useState<View>("Worklist");
  const [selectedPatientId, setSelectedPatientId] = useState("PT-001");
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [confirmFullReset, setConfirmFullReset] = useState(false);
  const [notice, setNotice] = useState("");
  const owner = (session?.user?.email ?? "").toLowerCase();
  const courseRole = courseData?.user.role ?? ((session?.user as { courseRole?: "student" | "instructor" | "admin" } | undefined)?.courseRole ?? "student");
  const config = courseData?.config ?? defaultCourseConfig;

  useEffect(() => {
    if (sessionStatus !== "authenticated" || bootstrapped) return;
    refresh().catch(() => undefined).finally(() => setBootstrapped(true));
  }, [sessionStatus, bootstrapped, refresh]);

  const onProgress = useCallback((rows: ProgressRow[]) => { if (!preview) mergeProgress(rows); }, [mergeProgress, preview]);
  const workspace = useWorkspace({ owner, role, enabled: bootstrapped && sessionStatus === "authenticated", readOnly: Boolean(preview), cloudWorkspace: preview ? preview.workspace : courseData?.workspace, hydrateKey: preview ? `preview:${preview.email}` : "self", onProgress });
  const { state, dispatch, replace, ready, storage, setStorage, flushSync } = workspace;

  const patient = state.patients.find((p) => p.id === selectedPatientId) ?? state.patients[0];
  const selectPatient = useCallback((id: string, nextView?: View) => { setSelectedPatientId(id); if (nextView) setView(nextView); }, []);
  const roleViews = useMemo(() => config.simulatedRoles.find((item) => item.role === role)?.views ?? [], [config, role]);
  const visibleViews = VIEW_NAMES.filter((item) => roleViews.includes(item) || (item === "Gradebook" && courseRole !== "student") || (item === "Admin" && courseRole !== "student"));

  function exportWorkspace() {
    download(`fordms-workspace-${owner.split("@")[0] || "learner"}.json`, JSON.stringify(exportEnvelope(state, owner), null, 2));
    dispatch({ type: "noteExport", kind: "workspace" });
  }

  function exportLearnerReport() {
    const events = state.audit.map(toProgressEvent);
    const report = {
      generatedAt: new Date().toISOString(),
      course: "HINF 6105 Electronic Health Records",
      learner: owner,
      workspaceVersion: state.version,
      configVersion: courseData?.configVersion ?? 0,
      progress: (courseData?.assignments ?? []).map((assignment) => ({ id: assignment.id, title: assignment.title, ...computeProgress(assignment, events) })),
      submissions: courseData?.submissions ?? [],
      auditEvidence: state.audit,
    };
    download("fordms-learner-evidence.json", JSON.stringify(report, null, 2));
    dispatch({ type: "noteExport", kind: "report" });
  }

  function importWorkspace(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || preview) return;
    file.text().then(async (text) => {
      const imported = importEnvelope(text, owner);
      const next: EHRState = { ...imported.state, audit: [{ id: makeId("AUD"), timestamp: new Date().toISOString(), actor: `${role} learner`, action: "Import workspace", detail: `Imported ${imported.eventCount} event(s)${imported.exportedAt ? ` exported ${imported.exportedAt}` : ""}; imported evidence is tracked separately`, provenance: "earned" }, ...imported.state.audit] };
      replace(next);
      setNotice(`Imported ${imported.eventCount} event(s). Imported evidence is labeled and counted separately from work done in this workspace.`);
      try { await postJson("/api/course/reset", { scope: "import", workspace: next }); await refresh(); } catch { setNotice("Import saved locally, but the cloud copy could not be updated yet. It will retry on your next action."); }
    }).catch(() => setNotice("Import failed. Choose a FordMS workspace export (JSON) created by this application."));
  }

  async function resetAll() {
    setConfirmFullReset(false);
    const next = fullReset(state, `${role} learner`);
    replace(next);
    setNotice("Course workspace reset to the synthetic starting state. Submitted assignment versions were kept.");
    setSelectedPatientId("PT-001");
    setView("Worklist");
    try { await postJson("/api/course/reset", { scope: "all", workspace: next }); await refresh(); } catch { setStorage({ message: "Reset saved locally; the cloud copy will update on your next action.", tone: "error" }); }
  }

  async function enterPreview(email: string) {
    const payload = await postJsonSafeGet(`/api/instructor/preview?email=${encodeURIComponent(email)}`);
    setPreview({ email, name: payload.student?.name ?? email, workspace: payload.workspace, progress: payload.progress, submissions: payload.submissions });
    setRole("Clinical");
    setView("Worklist");
    setSelectedPatientId("PT-001");
  }

  function exitPreview() {
    setPreview(null);
    setView("Gradebook");
    refresh().catch(() => undefined);
  }

  if (sessionStatus === "loading" || (sessionStatus === "authenticated" && !bootstrapped)) {
    return <div className="app-shell"><main id="practice-ehr-main" tabIndex={-1}><Panel title="FordMS EHR" subtitle="Loading your Fordham course workspace"><p className="empty">Connecting to your course account…</p></Panel></main></div>;
  }

  const viewProps: ViewProps = { state, dispatch, config, patient, role, selectPatient, setView, makeId, readOnly: Boolean(preview) };
  const previewCourseData = preview && courseData ? { ...courseData, workspace: preview.workspace, progress: preview.progress, submissions: preview.submissions as CourseDataSubmissions } : courseData;

  return <div className="app-shell">
    <a className="skip-link" href="#practice-ehr-main" onClick={() => document.getElementById("practice-ehr-main")?.focus()}>Skip to main content</a>
    <TopBar name={session?.user?.name ?? "Fordham learner"} email={owner} courseRole={courseRole} role={role} roles={roles} onRoleChange={(next) => { setRole(next); setView(defaultViewForRole[next]); }} onExport={exportWorkspace} onImport={importWorkspace} onReset={() => setConfirmFullReset(true)} onSignOut={() => signOut({ callbackUrl: "/login" })} readOnly={Boolean(preview)} configVersion={courseData?.configVersion ?? 0} />
    {preview && <div className="preview-banner" role="status"><span>Preview mode: viewing {preview.name} ({preview.email}) read-only. Nothing you do here is saved to the student's record.</span><button onClick={exitPreview}>Exit preview</button></div>}
    <div className="storage-line" role="status" aria-live="polite"><span className={storage.tone === "error" ? "storage-error" : storage.tone === "busy" ? "storage-busy" : "storage-ok"} />{courseError && !courseData ? `${courseError} ` : ""}{storage.message}</div>
    {notice && <div className="notice-line" role="status"><span className="storage-ok" />{notice}<button className="text-button" onClick={() => setNotice("")}>Dismiss</button></div>}
    <nav className="nav-tabs" aria-label="FordMS EHR modules">{visibleViews.map((item) => <button key={item} className={view === item ? "active" : ""} aria-current={view === item ? "page" : undefined} onClick={() => setView(item)}>{item}</button>)}</nav>
    {PATIENT_VIEWS.has(view) && <PatientBanner patient={patient} />}
    <main id="practice-ehr-main" tabIndex={-1}>
      {!ready && view !== "Gradebook" && view !== "Admin" && <p className="empty">Preparing the workspace…</p>}
      {view === "Worklist" && <Worklist {...viewProps} />}
      {view === "Schedule" && <Schedule {...viewProps} />}
      {view === "Registration" && <Registration {...viewProps} />}
      {view === "Patients" && <Patients {...viewProps} />}
      {view === "MPI" && <MPIWorkbench {...viewProps} />}
      {view === "Encounter" && <Encounter {...viewProps} />}
      {view === "Orders & Results" && <OrdersResults {...viewProps} />}
      {view === "Portal" && <Portal {...viewProps} />}
      {view === "HIE" && <HIEReconciliation {...viewProps} />}
      {view === "Analytics" && <Analytics {...viewProps} />}
      {view === "Query Studio" && <QueryStudio {...viewProps} />}
      {view === "AI Review" && <AIReview {...viewProps} />}
      {view === "Implementation" && <ImplementationReadiness {...viewProps} />}
      {view === "Audit Review" && <AuditReview {...viewProps} />}
      {view === "Assignments" && <Assignments state={state} courseData={previewCourseData} readOnly={Boolean(preview)} exportLearnerReport={exportLearnerReport} refreshCourseData={refresh} flushSync={flushSync} replaceWorkspace={replace} />}
      {view === "Gradebook" && courseRole !== "student" && <Gradebook courseRole={courseRole} onPreview={enterPreview} />}
      {view === "Admin" && courseRole !== "student" && <AdminConsole courseRole={courseRole} onConfigPublished={() => refresh().catch(() => undefined)} />}
    </main>
    <footer><span>Fordham University · Applied Health Informatics</span><span>All names and clinical data are fictional · not for clinical use <SimulationBadge /></span><button onClick={() => window.print()}>Print current view</button></footer>
    <ConfirmDialog open={confirmFullReset} title="Reset the entire workspace?" body={<p>Every chart change, order, note draft, and audit event in this workspace returns to the synthetic starting state. Your submitted assignment versions are kept. Export your evidence first if you need a copy. To reset a single assignment instead, use the Assignments tab.</p>} confirmLabel="Reset everything" danger onConfirm={resetAll} onCancel={() => setConfirmFullReset(false)} />
  </div>;
}

type CourseDataSubmissions = NonNullable<ReturnType<typeof useCourseData>["courseData"]>["submissions"];

async function postJsonSafeGet(url: string) {
  const { apiFetch } = await import("@/lib/api");
  return apiFetch<{ student?: { name?: string }; workspace: EHRState | null; progress: ProgressRow[]; submissions: unknown[] }>(url);
}
