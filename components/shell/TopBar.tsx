"use client";

import type { ChangeEvent } from "react";
import type { CourseRole, Role } from "@/lib/types";

interface Props {
  name: string;
  email: string;
  courseRole: CourseRole;
  role: Role;
  roles: Role[];
  onRoleChange: (role: Role) => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  onSignOut: () => void;
  readOnly: boolean;
  configVersion: number;
}

export function TopBar({ name, email, courseRole, role, roles, onRoleChange, onExport, onImport, onReset, onSignOut, readOnly, configVersion }: Props) {
  return <header className="topbar">
    <div className="brand"><span className="brand-mark" aria-hidden="true">F</span><div><span className="brand-university">Fordham University</span><strong>FordMS EHR</strong><small>HINF 6105 · Electronic Health Records · config v{configVersion}</small></div></div>
    <div className="top-actions">
      <div className="account-chip"><strong>{name}</strong><span>{email} · {courseRole}</span></div>
      <label className="role-label">Role<select aria-label="Select simulated role" value={role} onChange={(e) => onRoleChange(e.target.value as Role)}>{roles.map((r) => <option key={r}>{r}</option>)}</select></label>
      <button onClick={onExport} disabled={readOnly}>Export evidence</button>
      <label className="buttonlike">Import<input aria-label="Import workspace" type="file" accept="application/json" onChange={onImport} disabled={readOnly} /></label>
      <button className="danger-button" onClick={onReset} disabled={readOnly}>Reset all</button>
      <button onClick={onSignOut}>Sign out</button>
    </div>
  </header>;
}
