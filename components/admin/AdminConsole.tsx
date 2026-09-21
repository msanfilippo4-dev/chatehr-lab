"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Field, InlineAlert, Panel, SimulationBadge, Status } from "@/components/ui/primitives";
import { apiFetch, postJson } from "@/lib/api";
import { ACTION_IDS } from "@/lib/actions";
import { CourseConfigSchema, SECTION_SCHEMAS } from "@/lib/config/schema";
import type { CourseAssignment, CourseConfig } from "@/lib/config/types";
import type { AssignmentRelease, CourseRole } from "@/lib/types";
import { formatWhen } from "@/components/views/shared";

interface AdminPayload { published: CourseConfig; version: number; publishedAt: string | null; invalidSections: { section: string; problems: string[] }[]; defaults: CourseConfig; versions: { version: number; status: string; change_summary: string | null; created_by: string; created_at: string; published_at: string | null }[]; releases: AssignmentRelease[] }

const SECTION_GROUPS: { title: string; sections: (keyof CourseConfig)[] }[] = [
  { title: "Coding", sections: ["icd10Catalog", "cptCatalog"] },
  { title: "Coverage", sections: ["insurers", "coverageFields"] },
  { title: "Organization", sections: ["organizations", "facilities", "departments", "locations", "specialties", "providerRoles", "providers"] },
  { title: "Scheduling", sections: ["visitTypes", "noteTemplates", "appointmentRules"] },
  { title: "Clinical", sections: ["medicationExamples", "labExamples", "alertRules", "messageCategories", "routingRules"] },
  { title: "Course", sections: ["assignments", "simulatedRoles", "permissions", "meta"] },
];

const SECTION_LABEL: Partial<Record<keyof CourseConfig, string>> = { icd10Catalog: "ICD-10-CM examples", cptCatalog: "CPT examples", coverageFields: "Coverage fields", providerRoles: "Provider roles", visitTypes: "Visit types", noteTemplates: "Note templates", appointmentRules: "Appointment rules", medicationExamples: "Medication examples", labExamples: "Laboratory examples", alertRules: "Alert rules", messageCategories: "Message categories", routingRules: "Routing rules", simulatedRoles: "Simulated roles and views", meta: "Version metadata" };

export function AdminConsole({ courseRole, onConfigPublished }: { courseRole: CourseRole; onConfigPublished: () => void }) {
  const [payload, setPayload] = useState<AdminPayload | null>(null);
  const [draft, setDraft] = useState<CourseConfig | null>(null);
  const [section, setSection] = useState<keyof CourseConfig>("icd10Catalog");
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [changeSummary, setChangeSummary] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" }>({ text: "", tone: "success" });
  const [problems, setProblems] = useState<string[]>([]);
  const [tab, setTab] = useState<"catalogs" | "releases" | "history">("catalogs");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await apiFetch<AdminPayload>("/api/admin/config");
    setPayload(data);
    setDraft(structuredClone(data.published));
    setDirty(new Set());
  }, []);
  useEffect(() => { load().catch((caught) => setMessage({ text: caught instanceof Error ? caught.message : "Admin console could not load.", tone: "error" })); }, [load]);

  const validation = useMemo(() => (draft ? CourseConfigSchema.safeParse(draft) : null), [draft]);

  function update<K extends keyof CourseConfig>(key: K, value: CourseConfig[K]) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
    setDirty(new Set([...dirty, key]));
  }

  async function save(action: "draft" | "publish") {
    if (!draft) return;
    const parsed = CourseConfigSchema.safeParse(draft);
    if (!parsed.success) { setProblems(parsed.error.issues.slice(0, 8).map((issue) => `${issue.path.join(".")}: ${issue.message}`)); setMessage({ text: "Fix the validation problems before saving.", tone: "error" }); return; }
    setProblems([]);
    setBusy(true);
    try {
      const result = await postJson<{ version: number; status: string }>("/api/admin/config", { action, config: parsed.data, changeSummary });
      setMessage({ text: action === "publish" ? `Published configuration version ${result.version}. Students receive it on their next save.` : `Saved draft version ${result.version}.`, tone: "success" });
      setChangeSummary("");
      await load();
      if (action === "publish") onConfigPublished();
    } catch (caught) {
      setMessage({ text: caught instanceof Error ? caught.message : "Save failed.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function restore(version: number) {
    setBusy(true);
    try {
      const result = await postJson<{ version: number }>("/api/admin/config/history", { version, changeSummary: `Restored version ${version}` });
      setMessage({ text: `Restored version ${version} as new published version ${result.version}.`, tone: "success" });
      await load();
      onConfigPublished();
    } catch (caught) {
      setMessage({ text: caught instanceof Error ? caught.message : "Restore failed.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!payload || !draft) return <Panel title="Admin console" subtitle="Loading configuration"><p className="empty">{message.text || "Loading…"}</p></Panel>;

  return <div className="stack">
    <Panel title="Course configuration" subtitle={`Published version ${payload.version}${payload.publishedAt ? ` (${formatWhen(payload.publishedAt)})` : " (built-in defaults)"} · every publish is versioned, audited, and restorable`} actions={<><button className={tab === "catalogs" ? "active" : ""} onClick={() => setTab("catalogs")}>Catalogs and rules</button><button className={tab === "releases" ? "active" : ""} onClick={() => setTab("releases")}>Assignment releases</button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>History</button><SimulationBadge>Synthetic teaching data</SimulationBadge></>}>
      {payload.invalidSections.length > 0 && <div className="invalid-sections"><strong>Some published sections failed validation and fell back to defaults:</strong><ul>{payload.invalidSections.map((item) => <li key={item.section}>{item.section}: {item.problems.join("; ")}</li>)}</ul></div>}
      {message.text && <p className={`form-message ${message.tone}`} role="status">{message.text}</p>}
      <InlineAlert tone="info" title="Scope"><p>Catalogs are curated teaching examples with synthetic data, not complete code sets. Copyrighted code descriptors are summarized in plain language. Link to authoritative sources in the source field.</p></InlineAlert>
    </Panel>

    {tab === "catalogs" && <div className="admin-shell">
      <nav className="admin-nav" aria-label="Configuration sections">{SECTION_GROUPS.map((group) => <div key={group.title}><small className="help">{group.title}</small>{group.sections.map((key) => <button key={key} className={`${section === key ? "active" : ""} ${dirty.has(key) ? "dirty" : ""}`} onClick={() => setSection(key)}>{SECTION_LABEL[key] ?? key}</button>)}</div>)}</nav>
      <div className="stack">
        <Panel title={SECTION_LABEL[section] ?? section} subtitle={Array.isArray(draft[section]) ? `${(draft[section] as unknown[]).length} entries` : "Structured settings"} actions={<button onClick={() => { update(section, structuredClone(payload.defaults[section])); }}>Reset section to defaults</button>}>
          {section === "assignments" ? <AssignmentEditor assignments={draft.assignments} onChange={(value) => update("assignments", value)} /> : Array.isArray(draft[section]) ? <CatalogEditor rows={draft[section] as Record<string, unknown>[]} onChange={(rows) => update(section, rows as CourseConfig[typeof section])} /> : <JsonEditor value={draft[section]} onChange={(value) => update(section, value as CourseConfig[typeof section])} schemaKey={section} />}
        </Panel>
        <Panel title="Validate, save, publish" subtitle={validation?.success ? "Draft is valid" : `Draft has ${validation?.error.issues.length ?? 0} problem(s)`}>
          {problems.length > 0 && <ul className="help">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
          {!validation?.success && validation && <ul className="help">{validation.error.issues.slice(0, 6).map((issue, index) => <li key={index}>{issue.path.join(".")}: {issue.message}</li>)}</ul>}
          <div className="publish-bar">
            <Field label="Change summary (required to publish)"><input value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} placeholder="What changed and why" /></Field>
            <div className="button-row"><button onClick={() => { const parsed = CourseConfigSchema.safeParse(draft); setProblems(parsed.success ? [] : parsed.error.issues.slice(0, 8).map((issue) => `${issue.path.join(".")}: ${issue.message}`)); setMessage({ text: parsed.success ? "Draft is valid." : "Validation found problems.", tone: parsed.success ? "success" : "error" }); }}>Validate</button><button disabled={busy} onClick={() => save("draft")}>Save draft</button><button className="primary" disabled={busy || !changeSummary.trim() || (courseRole !== "admin" && !draft.permissions.instructorCanPublishConfig)} onClick={() => save("publish")}>Publish</button></div>
            <small className="help">Dirty sections: {dirty.size ? [...dirty].join(", ") : "none"}. Publishing archives the previous version; students see the new catalogs after their next save.</small>
          </div>
        </Panel>
      </div>
    </div>}

    {tab === "releases" && <ReleasePanel releases={payload.releases} assignments={draft.assignments} onChanged={async () => { await load(); onConfigPublished(); }} />}

    {tab === "history" && <Panel title="Configuration history" subtitle="Restore republishes an earlier document as a new version">
      <table className="version-table"><thead><tr><th>Version</th><th>Status</th><th>Summary</th><th>By</th><th>Created</th><th></th></tr></thead><tbody>{payload.versions.map((row) => <tr key={row.version}><td>{row.version}</td><td><Status tone={row.status === "published" ? "good" : row.status === "draft" ? "warn" : "neutral"}>{row.status}</Status></td><td>{row.change_summary ?? "—"}</td><td>{row.created_by}</td><td>{formatWhen(row.created_at)}</td><td>{row.status !== "published" && <button disabled={busy} onClick={() => restore(row.version)}>Restore</button>}</td></tr>)}{!payload.versions.length && <tr><td colSpan={6} className="empty">No versions have been saved. Version 0 is the built-in default.</td></tr>}</tbody></table>
    </Panel>}
  </div>;
}

function CatalogEditor({ rows, onChange }: { rows: Record<string, unknown>[]; onChange: (rows: Record<string, unknown>[]) => void }) {
  const [rawMode, setRawMode] = useState(false);
  const columns = useMemo(() => { const keys = new Set<string>(); rows.forEach((row) => Object.keys(row).forEach((key) => keys.add(key))); return [...keys]; }, [rows]);
  if (rawMode || !rows.length) return <div><div className="admin-toolbar"><button onClick={() => setRawMode(false)} disabled={!rows.length}>Table view</button></div><JsonEditor value={rows} onChange={(value) => onChange(value as Record<string, unknown>[])} /></div>;
  const template = Object.fromEntries(columns.map((key) => [key, typeof rows[0][key] === "number" ? 0 : typeof rows[0][key] === "boolean" ? false : Array.isArray(rows[0][key]) ? [] : typeof rows[0][key] === "object" && rows[0][key] !== null ? {} : ""]));
  return <div>
    <div className="admin-toolbar"><button onClick={() => onChange([...rows, template])}>Add row</button><button onClick={() => setRawMode(true)}>JSON view</button><span className="spacer" /><small className="help">Arrays and nested objects are edited as JSON text.</small></div>
    <div style={{ overflowX: "auto" }}><table className="catalog-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}<th></th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => { const value = row[column]; const set = (next: unknown) => onChange(rows.map((r, i) => (i === index ? { ...r, [column]: next } : r))); if (typeof value === "boolean") return <td key={column} className="narrow"><input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} aria-label={`${column} row ${index + 1}`} /></td>; if (typeof value === "number") return <td key={column} className="narrow"><input type="number" value={value} onChange={(e) => set(Number(e.target.value))} aria-label={`${column} row ${index + 1}`} /></td>; if (typeof value === "object" && value !== null) return <td key={column}><textarea aria-label={`${column} row ${index + 1}`} defaultValue={JSON.stringify(value)} onBlur={(e) => { try { set(JSON.parse(e.target.value)); } catch { /* keep previous */ } }} /></td>; const text = String(value ?? ""); return <td key={column}>{text.length > 60 ? <textarea aria-label={`${column} row ${index + 1}`} value={text} onChange={(e) => set(e.target.value)} /> : <input aria-label={`${column} row ${index + 1}`} value={text} onChange={(e) => set(e.target.value)} />}</td>; })}<td className="narrow"><button onClick={() => onChange(rows.filter((_, i) => i !== index))} aria-label={`Remove row ${index + 1}`}>Remove</button></td></tr>)}</tbody></table></div>
  </div>;
}

function JsonEditor({ value, onChange, schemaKey }: { value: unknown; onChange: (value: unknown) => void; schemaKey?: keyof CourseConfig }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState("");
  useEffect(() => { setText(JSON.stringify(value, null, 2)); }, [value]);
  return <div>
    <textarea className="json-editor" aria-label="JSON editor" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { try { const parsed = JSON.parse(text); if (schemaKey && SECTION_SCHEMAS[schemaKey]) { const result = SECTION_SCHEMAS[schemaKey].safeParse(parsed); if (!result.success) { setError(result.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")); return; } } setError(""); onChange(parsed); } catch { setError("Not valid JSON."); } }} />
    {error && <p className="form-message error">{error}</p>}
    <small className="help">Changes apply when you leave the field.</small>
  </div>;
}

function AssignmentEditor({ assignments, onChange }: { assignments: CourseAssignment[]; onChange: (value: CourseAssignment[]) => void }) {
  const [activeId, setActiveId] = useState(assignments[0]?.id ?? "");
  const active = assignments.find((item) => item.id === activeId) ?? assignments[0];
  if (!active) return <p className="empty">No assignments defined.</p>;
  const set = (patch: Partial<CourseAssignment>) => onChange(assignments.map((item) => (item.id === active.id ? { ...item, ...patch } : item)));
  const rubricTotal = active.rubric.reduce((sum, item) => sum + item.points, 0);
  return <div className="stack">
    <div className="subtabs">{assignments.map((item) => <button key={item.id} className={item.id === active.id ? "active" : ""} onClick={() => setActiveId(item.id)}>{item.id}</button>)}</div>
    <div className="registration-grid">
      <Field label="Title"><input value={active.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="Short title"><input value={active.shortTitle} onChange={(e) => set({ shortTitle: e.target.value })} /></Field>
      <Field label="Due (ISO with offset)"><input value={active.dueAt} onChange={(e) => set({ dueAt: e.target.value })} /></Field>
      <Field label="Due label (shown to students)"><input value={active.dueLabel} onChange={(e) => set({ dueLabel: e.target.value })} /></Field>
      <Field label="Weight (% of course)"><input type="number" value={active.weightPercent} onChange={(e) => set({ weightPercent: Number(e.target.value) })} /></Field>
      <Field label="Estimated minutes"><input type="number" value={active.estimatedMinutes} onChange={(e) => set({ estimatedMinutes: Number(e.target.value) })} /></Field>
      <Field label="Week introduced"><input type="number" value={active.weekIntroduced} onChange={(e) => set({ weekIntroduced: Number(e.target.value) })} /></Field>
      <Field label="Release state (release table overrides)"><select value={active.releaseState} onChange={(e) => set({ releaseState: e.target.value as CourseAssignment["releaseState"] })}><option>hidden</option><option>released</option><option>closed</option></select></Field>
    </div>
    <Field label="Scenario"><textarea rows={3} value={active.scenario} onChange={(e) => set({ scenario: e.target.value })} /></Field>
    <Field label="Objectives (one per line)"><textarea rows={4} value={active.objectives.join("\n")} onChange={(e) => set({ objectives: e.target.value.split("\n").filter(Boolean) })} /></Field>
    <Field label="Workflow steps (one per line)"><textarea rows={5} value={active.workflow.join("\n")} onChange={(e) => set({ workflow: e.target.value.split("\n").filter(Boolean) })} /></Field>
    <Field label="Submission prompt"><textarea rows={3} value={active.submissionPrompt} onChange={(e) => set({ submissionPrompt: e.target.value })} /></Field>
    <h3>Required actions</h3>
    <table className="catalog-table"><thead><tr><th>Action</th><th>Label</th><th>Minimum</th><th>Context match</th><th></th></tr></thead><tbody>{active.requirements.map((requirement, index) => <tr key={index}><td><select value={requirement.action} onChange={(e) => set({ requirements: active.requirements.map((r, i) => (i === index ? { ...r, action: e.target.value } : r)) })}>{ACTION_IDS.map((id) => <option key={id}>{id}</option>)}</select></td><td><input value={requirement.label} onChange={(e) => set({ requirements: active.requirements.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)) })} /></td><td className="narrow"><input type="number" min={1} value={requirement.minimumCount} onChange={(e) => set({ requirements: active.requirements.map((r, i) => (i === index ? { ...r, minimumCount: Number(e.target.value) } : r)) })} /></td><td><input value={requirement.contextMatch ?? ""} onChange={(e) => set({ requirements: active.requirements.map((r, i) => (i === index ? { ...r, contextMatch: e.target.value || undefined } : r)) })} placeholder="optional prefix" /></td><td className="narrow"><button onClick={() => set({ requirements: active.requirements.filter((_, i) => i !== index) })}>Remove</button></td></tr>)}</tbody></table>
    <button onClick={() => set({ requirements: [...active.requirements, { action: ACTION_IDS[0], label: "New requirement", minimumCount: 1 }] })}>Add requirement</button>
    <h3>Rubric (must total 100 · currently {rubricTotal})</h3>
    <table className="catalog-table"><thead><tr><th>Criterion</th><th>Points</th><th>Standard</th><th></th></tr></thead><tbody>{active.rubric.map((item, index) => <tr key={index}><td><input value={item.criterion} onChange={(e) => set({ rubric: active.rubric.map((r, i) => (i === index ? { ...r, criterion: e.target.value } : r)) })} /></td><td className="narrow"><input type="number" min={0} value={item.points} onChange={(e) => set({ rubric: active.rubric.map((r, i) => (i === index ? { ...r, points: Number(e.target.value) } : r)) })} /></td><td><textarea value={item.standard} onChange={(e) => set({ rubric: active.rubric.map((r, i) => (i === index ? { ...r, standard: e.target.value } : r)) })} /></td><td className="narrow"><button onClick={() => set({ rubric: active.rubric.filter((_, i) => i !== index) })}>Remove</button></td></tr>)}</tbody></table>
    <button onClick={() => set({ rubric: [...active.rubric, { criterion: "New criterion", points: 0, standard: "" }] })}>Add criterion</button>
  </div>;
}

function ReleasePanel({ releases, assignments, onChanged }: { releases: AssignmentRelease[]; assignments: CourseAssignment[]; onChanged: () => Promise<void> }) {
  const [message, setMessage] = useState("");
  const [forms, setForms] = useState<Record<string, { state: string; dueAt: string; closeAt: string; releaseAt: string; acceptLate: boolean }>>({});
  useEffect(() => {
    const next: typeof forms = {};
    for (const assignment of assignments) {
      const release = releases.find((row) => row.assignment_id === assignment.id);
      next[assignment.id] = { state: release?.state ?? assignment.releaseState, dueAt: release?.due_at ?? assignment.dueAt, closeAt: release?.close_at ?? "", releaseAt: release?.release_at ?? "", acceptLate: release?.accept_late ?? true };
    }
    setForms(next);
  }, [releases, assignments]);
  async function save(id: string) {
    const form = forms[id];
    try {
      await postJson("/api/admin/releases", { assignmentId: id, state: form.state, dueAt: form.dueAt || null, closeAt: form.closeAt || null, releaseAt: form.releaseAt || null, acceptLate: form.acceptLate });
      setMessage(`Release settings saved for ${id}.`);
      await onChanged();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Save failed.");
    }
  }
  return <Panel title="Assignment releases" subtitle="Release state and due dates here override the configured assignment values">
    {message && <p className={`form-message ${message.startsWith("Release") ? "success" : "error"}`}>{message}</p>}
    <div className="release-grid">{assignments.map((assignment) => { const form = forms[assignment.id]; if (!form) return null; const set = (patch: Partial<typeof form>) => setForms({ ...forms, [assignment.id]: { ...form, ...patch } }); return <article className="release-card" key={assignment.id}><strong>{assignment.id} · {assignment.shortTitle}</strong><Field label="State"><select value={form.state} onChange={(e) => set({ state: e.target.value })}><option>hidden</option><option>released</option><option>closed</option></select></Field><Field label="Release at (ISO, optional)"><input value={form.releaseAt} onChange={(e) => set({ releaseAt: e.target.value })} placeholder="2026-10-05T18:00:00-04:00" /></Field><Field label="Due at (ISO with offset)"><input value={form.dueAt} onChange={(e) => set({ dueAt: e.target.value })} /></Field><Field label="Close at (ISO, optional)"><input value={form.closeAt} onChange={(e) => set({ closeAt: e.target.value })} /></Field><label className="field"><span><input type="checkbox" checked={form.acceptLate} onChange={(e) => set({ acceptLate: e.target.checked })} /> Accept late submissions (marked late)</span></label><button className="primary" onClick={() => save(assignment.id)}>Save</button></article>; })}</div>
  </Panel>;
}
