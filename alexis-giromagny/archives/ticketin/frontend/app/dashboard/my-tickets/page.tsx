"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TicketList } from "@/components/ticket-list";
import { ThemeToggle } from "@/components/theme-toggle";
import { FilterPill, SortButton } from "@/components/ticket-filters";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import {
  PRIORITY_DOT,
  PRIORITY_LABELS,
  STATUS_LABELS,
  clientName,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/tickets";

type StatusFilter = TicketStatus | "all";
type PriorityFilter = TicketPriority | "all";
type Period = "all" | "today" | "7d" | "30d";

const STATUS_FILTERS: TicketStatus[] = ["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVE"];
const PRIORITY_FILTERS: TicketPriority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const PERIOD_LABELS: Record<Period, string> = {
  all: "Tout",
  today: "Aujourd'hui",
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
};

const PERIOD_MS: Record<Period, number> = {
  all: Infinity,
  today: 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [period, setPeriod] = useState<Period>("all");
  const [sort, setSort] = useState<"recent" | "old">("recent");

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

  const scoped = useMemo(() => {
    const me = getCurrentUser()?.sub;
    if (!me) return [];
    return tickets.filter((t) => t.assigned_to_id === me);
  }, [tickets]);

  const statusCounts = useMemo(() => {
    const counts = { all: scoped.length } as Record<StatusFilter, number>;
    for (const s of STATUS_FILTERS) counts[s] = scoped.filter((t) => t.status === s).length;
    return counts;
  }, [scoped]);

  const activeCount = useMemo(
    () => scoped.filter((t) => t.status !== "RESOLVE" && t.status !== "CLOSED").length,
    [scoped]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const list = scoped.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (period !== "all" && now - new Date(t.updated_at).getTime() > PERIOD_MS[period]) return false;
      if (q && !`${t.title} ${clientName(t)} ${t.category} ${t.requester_email}`.toLowerCase().includes(q))
        return false;
      return true;
    });
    return list.sort((a, b) => {
      const diff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      return sort === "recent" ? diff : -diff;
    });
  }, [scoped, search, status, priority, period, sort]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Mes tickets</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{activeCount} tickets actifs</p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle className="size-11 shrink-0 rounded-xl border bg-background shadow-sm" />
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un ticket, client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-80 rounded-xl bg-background pl-9 shadow-sm"
            />
          </div>
        </div>
      </header>

      <section className="flex items-center gap-3 overflow-x-auto pb-1">
        <div className="flex shrink-0 items-center gap-2">
          <FilterPill active={status === "all"} onClick={() => setStatus("all")} count={statusCounts.all}>
            Tous
          </FilterPill>
          {STATUS_FILTERS.map((s) => (
            <FilterPill key={s} active={status === s} onClick={() => setStatus(s)} count={statusCounts[s]}>
              {STATUS_LABELS[s]}
            </FilterPill>
          ))}
        </div>

        <span className="h-6 w-px shrink-0 bg-border" />

        <div className="flex shrink-0 items-center gap-2">
          <FilterPill active={priority === "all"} onClick={() => setPriority("all")} subtle>
            Tous
          </FilterPill>
          {PRIORITY_FILTERS.map((p) => (
            <FilterPill key={p} active={priority === p} onClick={() => setPriority(p)} subtle>
              <span className={`size-2 rounded-full ${PRIORITY_DOT[p]}`} />
              {PRIORITY_LABELS[p]}
            </FilterPill>
          ))}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Période</span>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="h-9 w-44 rounded-lg bg-background">
                <SelectValue>{(v) => PERIOD_LABELS[(v as Period) ?? "all"]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center rounded-lg border p-0.5">
            <SortButton active={sort === "recent"} onClick={() => setSort("recent")}>
              Plus récents
            </SortButton>
            <SortButton active={sort === "old"} onClick={() => setSort("old")}>
              Plus anciens
            </SortButton>
          </div>

          <p className="text-sm text-muted-foreground tabular-nums">{filtered.length} résultats</p>
        </div>
      </section>

      <TicketList
        tickets={filtered}
        loading={loading}
        error={error}
        heading="Mes tickets"
        emptyLabel="Aucun ticket ne vous est assigné pour le moment."
        showToolbar={false}
      />
    </div>
  );
}
