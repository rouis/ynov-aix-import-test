"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleDashed, CircleDot, Inbox } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import {
  PRIORITY_DOT,
  PRIORITY_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
  timeAgo,
  type Ticket,
} from "@/lib/tickets";

const RECENT_COUNT = 8;

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setTickets(await apiFetch<Ticket[]>("/ticket", { auth: true }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chargement impossible");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(
    () => [
      {
        label: "Ouverts",
        count: tickets.filter((t) => t.status === "OPEN").length,
        icon: CircleDot,
        color: "text-blue-500",
        href: "/dashboard/tickets?status=OPEN",
      },
      {
        label: "En cours",
        count: tickets.filter((t) => t.status === "IN_PROGRESS").length,
        icon: CircleDashed,
        color: "text-amber-500",
        href: "/dashboard/tickets?status=IN_PROGRESS",
      },
      {
        label: "Résolus",
        count: tickets.filter((t) => t.status === "RESOLVE").length,
        icon: CheckCircle2,
        color: "text-emerald-500",
        href: "/dashboard/tickets?status=RESOLVE",
      },
      {
        label: "Non assignés",
        count: tickets.filter((t) => !t.assigned_to_id).length,
        icon: Inbox,
        color: "text-muted-foreground",
        href: "/dashboard/tickets?assignee=none",
      },
    ],
    [tickets]
  );

  const recent = useMemo(
    () =>
      [...tickets]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, RECENT_COUNT),
    [tickets]
  );

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">Vue d&apos;ensemble des tickets de votre organisation.</p>
      </section>

      {error && <Alert>{error}</Alert>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="flex items-center gap-4 p-5">
                <s.icon className={`size-8 shrink-0 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{loading ? "…" : s.count}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Activité récente</h2>
          <Link href="/dashboard/tickets" className="text-sm text-primary hover:underline">
            Tous les tickets
          </Link>
        </div>
        <div className="divide-y rounded-xl border bg-card">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : recent.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Aucun ticket pour l&apos;instant. Ils arrivent par email.
            </p>
          ) : (
            recent.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/tickets/${t.id}`}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50"
              >
                <span className={`size-2 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`} title={PRIORITY_LABELS[t.priority]} />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{t.title}</span>
                <Badge className={`shrink-0 ring-1 ring-inset ${STATUS_BADGE[t.status]}`}>
                  {STATUS_LABELS[t.status]}
                </Badge>
                <span className="w-24 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                  {timeAgo(t.updated_at)}
                </span>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
