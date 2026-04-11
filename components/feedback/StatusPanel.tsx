"use client";

import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";

interface StatusAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface StatusPanelProps {
  title: string;
  message: string;
  tone?: "error" | "info";
  className?: string;
  action?: StatusAction;
  secondaryAction?: StatusAction;
}

function ActionButton({
  action,
  primary,
}: {
  action: StatusAction;
  primary?: boolean;
}) {
  const className = primary
    ? "inline-flex items-center gap-2 rounded-lg bg-fordham-maroon px-4 py-2.5 t-small font-semibold text-white transition hover:bg-fordham-dark"
    : "inline-flex items-center gap-2 rounded-lg border border-[#d6dfeb] bg-white px-4 py-2.5 t-small font-semibold text-[#506680] transition hover:border-fordham-maroon/30 hover:text-fordham-maroon";

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

export default function StatusPanel({
  title,
  message,
  tone = "error",
  className,
  action,
  secondaryAction,
}: StatusPanelProps) {
  const isError = tone === "error";
  const Icon = isError ? AlertTriangle : Info;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        isError
          ? "border-amber-200 bg-amber-50"
          : "border-[#d6dfeb] bg-[#f8fbff]"
      } ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isError ? "bg-amber-100 text-amber-700" : "bg-white text-fordham-maroon"
          }`}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="t-heading text-lg">{title}</h2>
          <p className="mt-2 t-body t-secondary">{message}</p>
          {(action || secondaryAction) && (
            <div className="mt-4 flex flex-wrap gap-3">
              {action ? <ActionButton action={action} primary /> : null}
              {secondaryAction ? <ActionButton action={secondaryAction} /> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
