"use client";

import type { MouseEvent } from "react";
import { Icon, VIEW_ICONS } from "@/components/ui/Icon";
import type { View } from "@/lib/config/defaults";
import { hrefFor, NAV_GROUPS, ROLE_BLURBS } from "@/lib/navigation";
import type { Role } from "@/lib/types";

interface Props {
  role: Role;
  view: View;
  visible: View[];
  counts: Partial<Record<View, number>>;
  open: boolean;
  onNavigate: (view: View) => void;
}

/** Grouped left navigation. Links carry real URLs so they can be opened in a new tab. */
export function NavRail({ role, view, visible, counts, open, onNavigate }: Props) {
  function follow(event: MouseEvent<HTMLAnchorElement>, target: View) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate(target);
  }

  return (
    <nav className={`nav-rail${open ? " open" : ""}`} aria-label="FordMS EHR modules">
      <div className="rail-role">
        <span>Working as</span>
        <strong>{role}</strong>
        <small>{ROLE_BLURBS[role]}</small>
      </div>
      {NAV_GROUPS.map((group) => {
        const items = group.views.filter((item) => visible.includes(item));
        if (!items.length) return null;
        return (
          <div className="rail-group" key={group.label}>
            <h2>{group.label}</h2>
            <ul>
              {items.map((item) => (
                <li key={item}>
                  <a
                    href={hrefFor({ view: item, role })}
                    className={view === item ? "active" : ""}
                    aria-current={view === item ? "page" : undefined}
                    onClick={(event) => follow(event, item)}
                  >
                    <Icon name={VIEW_ICONS[item] ?? "chart"} />
                    <span className="rail-label">{item}</span>
                    {counts[item] ? <span className="rail-count" aria-hidden="true" title={`${counts[item]} open`}>{counts[item]}</span> : null}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
