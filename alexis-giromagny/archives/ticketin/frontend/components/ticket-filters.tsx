"use client";

import type { ReactNode } from "react";

/** Pastille de filtre (statut / priorité) utilisée dans les barres de filtres. */
export function FilterPill({
  children,
  active,
  onClick,
  count,
  subtle = false,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
  count?: number;
  subtle?: boolean;
}) {
  const base = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";
  const cls = active
    ? subtle
      ? "bg-muted text-foreground"
      : "bg-primary text-primary-foreground"
    : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <button type="button" onClick={onClick} className={`${base} ${cls}`}>
      {children}
      {count !== undefined && (
        <span className={`tabular-nums ${active && !subtle ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

/** Bouton de tri (segmenté) utilisé dans les barres de filtres. */
export function SortButton({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
        active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
