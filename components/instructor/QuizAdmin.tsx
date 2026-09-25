"use client";

import { useCallback, useEffect, useState } from "react";
import { Field, InlineAlert, Panel, Status } from "@/components/ui/primitives";
import { apiFetch, postJson } from "@/lib/api";
import { formatEt, fromEtInput, toEtInput } from "@/lib/quiz-time";

type ShowAnswers = "after_close" | "after_submit";

interface EffectiveQuiz {
  week: number;
  title: string;
  graded: boolean;
  available: boolean;
  legacy: boolean;
  mode: "fixed" | "drawn";
  opensAt: string | null;
  closesAt: string | null;
  timeLimitMin: number | null;
  drawCount: number;
  poolSize: number;
  attemptsAllowed: number | null;
  showAnswers: ShowAnswers;
  overridden: string[];
}

interface SettingsRow {
  week: number;
  opens_at: string | null;
  closes_at: string | null;
  time_limit_min: number | null;
  draw_count: number | null;
  attempts_allowed: number | null;
  show_answers: ShowAnswers | null;
  updated_by?: string | null;
  updated_at?: string | null;
}

interface WeekOverview {
  week: number;
  title: string;
  date: string;
  graded: boolean;
  available: boolean;
  legacy: boolean;
  mode: "fixed" | "drawn";
  poolSize: number;
  defaults: EffectiveQuiz;
  settings: SettingsRow | null;
  effective: EffectiveQuiz;
}

interface Extension {
  email: string;
  name: string | null;
  week: number;
  extra_minutes: number;
  closes_at_override: string | null;
  reason: string | null;
  created_by?: string | null;
}

interface StudentResult {
  email: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  enrollment_status: string;
  weeks: { week: number; graded: boolean; attempts: number; inProgress: boolean; best: number | null; late: boolean; autoSubmitted: boolean; dropped: boolean }[];
  category: { score: number | null; counted: number; dropped: number | null; droppedWeek: number | null };
}

interface Overview {
  schema: { windows: boolean; detail: string | null };
  weeks: WeekOverview[];
  extensions: Extension[];
  students: StudentResult[];
  gradedWeeks: number[];
  generatedAt: string;
}

interface ItemRow {
  id: string;
  question: string;
  correct: number;
  drawn: number;
  correctCount: number;
  percentCorrect: number | null;
  optionCounts: number[];
  blank: number;
  flag: "hard" | "easy" | null;
  options: string[];
}

interface ItemPayload {
  week: number;
  title: string;
  attempts: number;
  flagMinResponses: number;
  items: ItemRow[];
}

const LETTERS = ["A", "B", "C", "D"];
const SHOW_LABEL: Record<ShowAnswers, string> = { after_close: "After close", after_submit: "After each submit" };

function describeAttempts(value: number | null) {
  return value == null ? "Unlimited" : String(value);
}

function describeMinutes(value: number | null) {
  return value == null ? "Untimed" : `${value} min`;
}

function studentLabel(student: { name: string | null; first_name?: string | null; last_name?: string | null; email: string }) {
  if (student.last_name) return `${student.last_name}, ${student.first_name ?? ""}`;
  return student.name || student.email;
}

export function QuizAdmin({ includeTest }: { includeTest: boolean }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<Overview>(`/api/instructor/quizzes?includeTest=${includeTest ? 1 : 0}`));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Quiz data could not be loaded.");
    }
  }, [includeTest]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Panel title="Quizzes"><InlineAlert tone="danger" title="Quiz data unavailable"><p>{error}</p></InlineAlert></Panel>;
  if (!data) return <Panel title="Quizzes"><p className="empty">Loading quiz results…</p></Panel>;

  const testParam = includeTest ? "&includeTest=1" : "";

  return (
    <div className="stack">
      {!data.schema.windows && (
        <InlineAlert tone="warn" title="Apply migration 012 to enable timed quizzes">
          <p>
            Paste <code>supabase/migrations/012_fordms_quiz_windows.sql</code> into the Supabase SQL editor and run it.
            Until then quizzes run in fallback mode: fixed questions in bank order, no timer, no random draw, and settings
            and extensions cannot be saved. Existing attempts are unaffected either way.
          </p>
          {data.schema.detail && <p className="help">{data.schema.detail}</p>}
        </InlineAlert>
      )}
      {notice && <p className="form-message success" role="status">{notice}</p>}

      <ResultsGrid data={data} testParam={testParam} />
      <SettingsEditor data={data} onSaved={(text) => { setNotice(text); void load(); }} />
      <Extensions data={data} onSaved={(text) => { setNotice(text); void load(); }} />
      <ItemAnalysis weeks={data.weeks.filter((week) => week.available)} includeTest={includeTest} />
    </div>
  );
}

// ---------------------------------------------------------------- results grid

function ResultsGrid({ data, testParam }: { data: Overview; testParam: string }) {
  const graded = data.weeks.filter((week) => data.gradedWeeks.includes(week.week));
  return (
    <Panel
      title="Quiz results"
      subtitle="Best attempt per graded week; the lowest graded week is dropped (struck through). Missed quizzes count 0 once closed."
      actions={
        <>
          <a className="buttonlike" href={`/api/instructor/export?scope=quizzes${testParam}`}>Blackboard CSV</a>
          <a className="buttonlike" href={`/api/instructor/export?scope=quiz-category${testParam}`}>Category CSV</a>
          <a className="buttonlike" href={`/api/instructor/export?scope=quiz-attempts${testParam}`}>All attempts CSV</a>
        </>
      }
    >
      <div className="quiz-table-wrap"><table className="quiz-table quiz-results">
        <caption className="sr-only">Quiz results by student and graded week</caption>
        <thead>
          <tr>
            <th scope="col">Student</th>
            {graded.map((week) => <th scope="col" key={week.week}>W{week.week}</th>)}
            <th scope="col">Review weeks</th>
            <th scope="col">Category</th>
          </tr>
        </thead>
        <tbody>
          {data.students.map((student) => {
            const reviewAttempts = student.weeks.filter((cell) => !data.gradedWeeks.includes(cell.week)).reduce((sum, cell) => sum + cell.attempts, 0);
            return (
              <tr key={student.email}>
                <td>{studentLabel(student)}<small>{student.email}</small></td>
                {graded.map((week) => {
                  const cell = student.weeks.find((item) => item.week === week.week);
                  if (!cell) return <td key={week.week}><small>—</small></td>;
                  return (
                    <td key={week.week}>
                      {cell.best == null ? <small>—</small> : (
                        <span className={`status-pill ${cell.best >= 70 ? "graded" : "in_progress"}${cell.dropped ? " quiz-dropped" : ""}`} title={cell.dropped ? "Dropped (lowest graded week)" : undefined}>
                          {cell.best}%{cell.dropped && <span className="sr-only"> (dropped)</span>}
                        </span>
                      )}
                      {(cell.attempts > 0 || cell.inProgress) && (
                        <small>
                          {cell.attempts} attempt(s)
                          {cell.inProgress ? " · in progress" : ""}
                          {cell.autoSubmitted ? " · timed out" : ""}
                          {cell.late ? " · late" : ""}
                        </small>
                      )}
                      {cell.best == null && cell.dropped && <small>dropped (0)</small>}
                    </td>
                  );
                })}
                <td><small>{reviewAttempts ? `${reviewAttempts} attempt(s)` : "—"}</small></td>
                <td>
                  <strong>{student.category.score == null ? "—" : `${student.category.score}%`}</strong>
                  {student.category.droppedWeek != null && <small>dropped W{student.category.droppedWeek} ({student.category.dropped}%)</small>}
                </td>
              </tr>
            );
          })}
          {!data.students.length && <tr><td colSpan={graded.length + 3} className="empty">No students yet.</td></tr>}
        </tbody>
      </table></div>
    </Panel>
  );
}

// ---------------------------------------------------------------- settings

interface SettingsForm {
  opens: string;
  closes: string;
  minutes: string;
  draw: string;
  attempts: string;
  show: "" | ShowAnswers;
}

function formFrom(row: SettingsRow | null): SettingsForm {
  return {
    opens: toEtInput(row?.opens_at),
    closes: toEtInput(row?.closes_at),
    minutes: row?.time_limit_min == null ? "" : String(row.time_limit_min),
    draw: row?.draw_count == null ? "" : String(row.draw_count),
    attempts: row?.attempts_allowed == null ? "" : String(row.attempts_allowed),
    show: row?.show_answers ?? "",
  };
}

const intOrNull = (value: string) => (value.trim() === "" ? null : Math.round(Number(value)));

function SettingsEditor({ data, onSaved }: { data: Overview; onSaved: (message: string) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState<SettingsForm>(formFrom(null));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const week = data.weeks.find((item) => item.week === selected) ?? null;

  function edit(number: number) {
    const target = data.weeks.find((item) => item.week === number) ?? null;
    setSelected(number);
    setForm(formFrom(target?.settings ?? null));
    setMessage("");
  }

  async function save(reset = false) {
    if (!week) return;
    setSaving(true);
    setMessage("");
    const body = reset
      ? { week: week.week, opens_at: null, closes_at: null, time_limit_min: null, draw_count: null, attempts_allowed: null, show_answers: null }
      : {
        week: week.week,
        opens_at: fromEtInput(form.opens),
        closes_at: fromEtInput(form.closes),
        time_limit_min: intOrNull(form.minutes),
        draw_count: intOrNull(form.draw),
        attempts_allowed: intOrNull(form.attempts),
        show_answers: form.show || null,
      };
    try {
      await apiFetch("/api/instructor/quizzes/settings", { method: "PUT", body: JSON.stringify(body) });
      onSaved(reset ? `Week ${week.week} settings reset to the bank defaults.` : `Week ${week.week} settings saved.`);
      if (reset) setForm(formFrom(null));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof SettingsForm) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });
  const isOverridden = (item: WeekOverview, key: string) => item.effective.overridden.includes(key);

  return (
    <Panel title="Quiz settings" subtitle="Times are Eastern. Blank fields use the bank default shown in grey. Overrides are marked with •.">
      <div className="quiz-table-wrap"><table className="quiz-table quiz-settings">
        <caption className="sr-only">Effective quiz settings per week</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Opens</th>
            <th scope="col">Closes</th>
            <th scope="col">Time</th>
            <th scope="col">Questions</th>
            <th scope="col">Attempts</th>
            <th scope="col">Answers shown</th>
            <th scope="col"><span className="sr-only">Edit</span></th>
          </tr>
        </thead>
        <tbody>
          {data.weeks.map((item) => {
            const effective = item.effective;
            const mark = (key: string) => (isOverridden(item, key) ? " •" : "");
            return (
              <tr key={item.week} className={item.week === selected ? "selected" : ""}>
                <td>
                  W{item.week} {item.graded ? <Status tone="info">Graded</Status> : <Status>Review</Status>}
                  <small>{item.available ? `${item.title}${item.legacy ? " · legacy (fixed, untimed)" : ""}` : "Not yet in the bank"}</small>
                </td>
                <td>{effective.opensAt ? formatEt(effective.opensAt) : "Always"}{mark("opensAt")}</td>
                <td>{effective.closesAt ? formatEt(effective.closesAt) : "Never"}{mark("closesAt")}</td>
                <td>{describeMinutes(effective.timeLimitMin)}{mark("timeLimitMin")}</td>
                <td>{effective.drawCount}{item.poolSize ? ` of ${item.poolSize}` : ""}{mark("drawCount")}</td>
                <td>{describeAttempts(effective.attemptsAllowed)}{mark("attemptsAllowed")}</td>
                <td>{SHOW_LABEL[effective.showAnswers]}{mark("showAnswers")}</td>
                <td>
                  <button className="text-button" disabled={!data.schema.windows} onClick={() => edit(item.week)} aria-label={`Edit week ${item.week} settings`}>
                    Edit
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>

      {week && (
        <form className="quiz-settings-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <h3>Week {week.week} settings{week.legacy ? " (legacy: question count and timer are fixed)" : ""}</h3>
          <div className="roster-edit">
            <Field label="Opens (ET)" hint={`Default: ${week.defaults.opensAt ? formatEt(week.defaults.opensAt) : "always open"}`}>
              <input type="datetime-local" value={form.opens} onChange={set("opens")} />
            </Field>
            <Field label="Closes (ET)" hint={`Default: ${week.defaults.closesAt ? formatEt(week.defaults.closesAt) : "never"}`}>
              <input type="datetime-local" value={form.closes} onChange={set("closes")} />
            </Field>
            <Field label="Time limit (minutes)" hint={`Default: ${describeMinutes(week.defaults.timeLimitMin)}. 0 = untimed.`}>
              <input type="number" min={0} max={600} inputMode="numeric" placeholder={week.defaults.timeLimitMin == null ? "untimed" : String(week.defaults.timeLimitMin)} value={form.minutes} onChange={set("minutes")} disabled={week.legacy} />
            </Field>
            <Field label="Questions drawn" hint={`Default: ${week.defaults.drawCount}${week.poolSize ? ` of ${week.poolSize} in the pool` : ""}.`}>
              <input type="number" min={1} max={Math.max(1, week.poolSize || 100)} inputMode="numeric" placeholder={String(week.defaults.drawCount)} value={form.draw} onChange={set("draw")} disabled={week.legacy} />
            </Field>
            <Field label="Attempts allowed" hint={`Default: ${describeAttempts(week.defaults.attemptsAllowed)}. 0 = unlimited.`}>
              <input type="number" min={0} max={100} inputMode="numeric" placeholder={week.defaults.attemptsAllowed == null ? "unlimited" : String(week.defaults.attemptsAllowed)} value={form.attempts} onChange={set("attempts")} />
            </Field>
            <Field label="Show correct answers" hint={`Default: ${SHOW_LABEL[week.defaults.showAnswers]}.`}>
              <select value={form.show} onChange={set("show")}>
                <option value="">Default</option>
                <option value="after_close">After close</option>
                <option value="after_submit">After each submit</option>
              </select>
            </Field>
          </div>
          <div className="button-row">
            <button className="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
            <button type="button" disabled={saving || !week.settings} onClick={() => void save(true)}>Reset to defaults</button>
            <button type="button" onClick={() => setSelected(null)}>Close</button>
          </div>
          {message && <p className="form-message error" role="alert">{message}</p>}
        </form>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- extensions

function Extensions({ data, onSaved }: { data: Overview; onSaved: (message: string) => void }) {
  const [email, setEmail] = useState("");
  const [week, setWeek] = useState("");
  const [minutes, setMinutes] = useState("");
  const [closes, setCloses] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const available = data.weeks.filter((item) => item.available || item.graded);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await postJson("/api/instructor/quizzes/extensions", {
        email,
        week: Number(week),
        extra_minutes: minutes ? Number(minutes) : 0,
        closes_at_override: fromEtInput(closes),
        reason: reason.trim() || null,
      });
      onSaved(`Extension saved for ${email}, week ${week}.`);
      setMinutes("");
      setCloses("");
      setReason("");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The extension could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: Extension) {
    try {
      await apiFetch(`/api/instructor/quizzes/extensions?email=${encodeURIComponent(row.email)}&week=${row.week}`, { method: "DELETE" });
      onSaved(`Removed the week ${row.week} extension for ${row.email}.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The extension could not be removed.");
    }
  }

  return (
    <Panel title="Extensions" subtitle="Extra minutes lengthen each attempt's timer; a close override lets one student take the quiz later. Both apply only to that student and week.">
      <form className="quiz-extension-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <div className="roster-edit">
          <Field label="Student">
            <select value={email} onChange={(event) => setEmail(event.target.value)} required disabled={!data.schema.windows}>
              <option value="">Choose a student</option>
              {data.students.map((student) => <option key={student.email} value={student.email}>{studentLabel(student)} ({student.email})</option>)}
            </select>
          </Field>
          <Field label="Week">
            <select value={week} onChange={(event) => setWeek(event.target.value)} required disabled={!data.schema.windows}>
              <option value="">Choose a week</option>
              {available.map((item) => <option key={item.week} value={item.week}>Week {item.week}{item.graded ? " (graded)" : ""}</option>)}
            </select>
          </Field>
          <Field label="Extra minutes">
            <input type="number" min={0} max={600} inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} disabled={!data.schema.windows} />
          </Field>
          <Field label="Close override (ET)">
            <input type="datetime-local" value={closes} onChange={(event) => setCloses(event.target.value)} disabled={!data.schema.windows} />
          </Field>
          <Field label="Reason">
            <input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="e.g. accommodation letter" disabled={!data.schema.windows} />
          </Field>
        </div>
        <div className="button-row">
          <button className="primary" type="submit" disabled={saving || !data.schema.windows || !email || !week}>{saving ? "Saving…" : "Save extension"}</button>
        </div>
        {message && <p className="form-message error" role="alert">{message}</p>}
      </form>
      <div className="quiz-table-wrap"><table className="quiz-table">
        <caption className="sr-only">Current extensions</caption>
        <thead>
          <tr><th scope="col">Student</th><th scope="col">Week</th><th scope="col">Extra</th><th scope="col">Closes</th><th scope="col">Reason</th><th scope="col"><span className="sr-only">Remove</span></th></tr>
        </thead>
        <tbody>
          {data.extensions.map((row) => (
            <tr key={`${row.email}-${row.week}`}>
              <td>{row.name || row.email}<small>{row.email}</small></td>
              <td>W{row.week}</td>
              <td>{row.extra_minutes ? `+${row.extra_minutes} min` : "—"}</td>
              <td>{row.closes_at_override ? formatEt(row.closes_at_override) : "—"}</td>
              <td>{row.reason || "—"}{row.created_by && <small>by {row.created_by}</small>}</td>
              <td><button className="text-button" onClick={() => void remove(row)} aria-label={`Remove week ${row.week} extension for ${row.email}`}>Remove</button></td>
            </tr>
          ))}
          {!data.extensions.length && <tr><td colSpan={6} className="empty">No extensions.</td></tr>}
        </tbody>
      </table></div>
    </Panel>
  );
}

// ---------------------------------------------------------------- item analysis

function ItemAnalysis({ weeks, includeTest }: { weeks: WeekOverview[]; includeTest: boolean }) {
  const [week, setWeek] = useState<number | null>(weeks[0]?.week ?? null);
  const [payload, setPayload] = useState<ItemPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (week == null) return;
    let cancelled = false;
    apiFetch<ItemPayload>(`/api/instructor/quizzes/items?week=${week}&includeTest=${includeTest ? 1 : 0}`)
      .then((result) => { if (!cancelled) { setPayload(result); setError(""); } })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Item analysis could not be loaded."); });
    return () => { cancelled = true; };
  }, [week, includeTest]);

  const testParam = includeTest ? "&includeTest=1" : "";
  const shown = payload && payload.week === week ? payload : null;

  return (
    <Panel
      title="Item analysis"
      subtitle={shown ? `${shown.attempts} submitted attempt(s). Items are flagged when fewer than 30% or more than 95% answer correctly (after ${shown.flagMinResponses}+ responses).` : "Per-question statistics over submitted attempts"}
      actions={week != null ? (
        <>
          <a className="buttonlike" href={`/api/instructor/export?scope=quiz-items&week=${week}${testParam}`}>Item CSV</a>
          <a className="buttonlike" href={`/api/instructor/export?scope=quiz-attempts&week=${week}${testParam}`}>Week attempts CSV</a>
        </>
      ) : undefined}
    >
      <div className="gradebook-toolbar">
        <Field label="Week">
          <select value={week ?? ""} onChange={(event) => setWeek(Number(event.target.value))}>
            {weeks.map((item) => <option key={item.week} value={item.week}>Week {item.week}: {item.title}</option>)}
          </select>
        </Field>
      </div>
      {error && <p className="form-message error" role="alert">{error}</p>}
      {!shown && !error && <p className="empty">Loading item analysis…</p>}
      {shown && (
        <div className="quiz-table-wrap"><table className="quiz-table quiz-items">
          <caption className="sr-only">Item analysis for week {shown.week}</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Drawn</th>
              <th scope="col">% correct</th>
              {LETTERS.map((letter) => <th scope="col" key={letter}>{letter}</th>)}
              <th scope="col">Blank</th>
            </tr>
          </thead>
          <tbody>
            {shown.items.map((item) => (
              <tr key={item.id} className={item.flag ? "quiz-flagged" : ""}>
                <td>
                  <strong>{item.id}</strong>
                  {item.flag && <> <Status tone={item.flag === "hard" ? "danger" : "warn"}>{item.flag === "hard" ? "Under 30%" : "Over 95%"}</Status></>}
                  <small className="quiz-item-question">{item.question}</small>
                </td>
                <td>{item.drawn}</td>
                <td>{item.percentCorrect == null ? "—" : `${item.percentCorrect}%`}</td>
                {LETTERS.map((letter, index) => (
                  <td key={letter} className={index === item.correct ? "quiz-key" : ""} title={item.options[index]}>
                    {item.optionCounts[index] ?? 0}
                    {index === item.correct && <span className="sr-only"> (correct answer)</span>}
                  </td>
                ))}
                <td>{item.blank}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </Panel>
  );
}
