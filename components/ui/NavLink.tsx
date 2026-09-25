"use client";

import type { MouseEvent, ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { hrefFor, type NavTarget } from "@/lib/navigation";

/**
 * In-app deep link: a real URL (so it can open in a new tab) that navigates in place
 * on a plain click. Used by guides, tickets, and cross-view shortcuts.
 */
export function NavLink({ target, navigate, children, className = "step-link", icon = "link" }: {
  target: NavTarget;
  navigate: (target: NavTarget) => void;
  children: ReactNode;
  className?: string;
  icon?: string | null;
}) {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigate(target);
  }
  return (
    <a href={hrefFor(target)} className={className} onClick={onClick}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </a>
  );
}
