"use client";

import { Children, cloneElement, isValidElement, useEffect, useId, useRef, type ReactElement, type ReactNode } from "react";

export function Panel({ title, subtitle, children, className = "", actions }: { title: string; subtitle?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return <section className={`panel ${className}`}><div className="panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{actions && <div className="panel-actions">{actions}</div>}</div>{children}</section>;
}

export type Tone = "neutral" | "good" | "warn" | "danger" | "info";

export function Status({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`status ${tone}`}>{children}</span>;
}

export function SimpleTable({ heads, rows, caption }: { heads: string[]; rows: (string | ReactNode)[][]; caption?: string }) {
  return <table>{caption && <caption className="sr-only">{caption}</caption>}<thead><tr>{heads.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>) : <tr><td colSpan={heads.length} className="empty">No records.</td></tr>}</tbody></table>;
}

export function InlineAlert({ tone = "info", title, children }: { tone?: "info" | "warn" | "danger" | "success"; title: string; children?: ReactNode }) {
  return <div className={`inline-alert ${tone}`} role={tone === "danger" ? "alert" : "status"}><strong>{title}</strong>{children}</div>;
}

/** Every simulated warning, score, or AI output carries this label. */
export function SimulationBadge({ children = "Teaching simulation" }: { children?: ReactNode }) {
  return <span className="sim-badge" title="FordMS is a teaching simulation with synthetic data. It is not a certified clinical system.">{children}</span>;
}

export function ConfirmDialog({ open, title, body, confirmLabel = "Confirm", danger = false, onConfirm, onCancel }: { open: boolean; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className="confirm-dialog" onCancel={(event) => { event.preventDefault(); onCancel(); }} aria-labelledby="confirm-title">
    <form method="dialog" onSubmit={(event) => { event.preventDefault(); onConfirm(); }}>
      <h2 id="confirm-title">{title}</h2>
      <div className="confirm-body">{body}</div>
      <div className="button-row"><button type="button" onClick={onCancel}>Cancel</button><button type="submit" className={danger ? "danger-button" : "primary"} autoFocus>{confirmLabel}</button></div>
    </form>
  </dialog>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const id = useId();
  const only = Children.count(children) === 1 ? Children.toArray(children)[0] : null;
  if (isValidElement(only)) {
    const control = only as ReactElement<{ id?: string }>;
    const controlId = control.props.id ?? id;
    return <div className="field"><label htmlFor={controlId}>{label}</label>{cloneElement(control, { id: controlId })}{hint && <small className="help">{hint}</small>}</div>;
  }
  return <label className="field"><span>{label}</span>{children}{hint && <small className="help">{hint}</small>}</label>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
