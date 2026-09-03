"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Flag, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PRIORITY_DOT,
  PRIORITY_LABELS,
  PRIORITY_RANK,
  STATUS_BADGE,
  STATUS_LABELS,
  assigneeInitials,
  assigneeName,
  avatarColor,
  clientName,
  timeAgo,
  type Ticket,
  type TicketPriority,
} from "@/lib/tickets";

type SortKey = "updated" | "created" | "priority";

const SORT_LABELS: Record<SortKey, string> = {
  updated: "Récemment mis à jour",
  created: "Récemment créé",
  priority: "Priorité",
};

interface TicketListProps {
  tickets: Ticket[];
  loading: boolean;
  error: string | null;
  heading: string;
  /** Message affiché quand la liste (avant recherche) est vide. */
  emptyLabel?: string;
  /** Affiche la barre d'outils interne (titre, recherche, filtres, tri). */
  showToolbar?: boolean;
}

export function TicketList({
  tickets,
  loading,
  error,
  heading,
  emptyLabel = "Aucune demande ne correspond à votre recherche.",
  showToolbar = true,
}: TicketListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");
  const [sort, setSort] = useState<SortKey>("updated");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = tickets.filter((t) => {
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (q && !`${t.title} ${t.description} ${t.requester_email}`.toLowerCase().includes(q))
        return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "priority") return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      const key = sort === "created" ? "created_at" : "updated_at";
      return new Date(b[key]).getTime() - new Date(a[key]).getTime();
    });
  }, [tickets, search, priorityFilter, sort]);

  return (
    <div className="space-y-6">
      {showToolbar && (
      <section className="flex flex-wrap items-center gap-3">
        <div className="mr-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{heading}</h1>
          {!loading && (
            <p className="text-sm text-muted-foreground">
              {visible.length} {visible.length > 1 ? "tickets" : "ticket"}
            </p>
          )}
        </div>

        <div className="group relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl bg-background pr-9 pl-9 shadow-sm transition-shadow focus-visible:shadow-md"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Effacer la recherche"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as TicketPriority | "all")}>
          <SelectTrigger className="h-10 w-48 rounded-xl bg-background shadow-sm transition-colors hover:bg-muted/50 data-[placeholder]:text-muted-foreground">
            <Flag className="size-4 shrink-0 text-muted-foreground" />
            <SelectValue>
              {(value) =>
                value && value !== "all"
                  ? PRIORITY_LABELS[value as TicketPriority]
                  : "Toutes priorités"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes priorités</SelectItem>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                <span className={`size-2 rounded-full ${PRIORITY_DOT[k as TicketPriority]}`} />
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-10 w-56 rounded-xl bg-background shadow-sm transition-colors hover:bg-muted/50">
            <ArrowUpDown className="size-4 shrink-0 text-muted-foreground" />
            <SelectValue>
              {(value) => SORT_LABELS[(value as SortKey) ?? "updated"]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>
      )}

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <TicketTableShell>
          {Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 8 }).map((__, j) => (
                <TableCell key={j} className="py-4">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TicketTableShell>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card py-16 text-center">
          <p className="text-sm font-medium text-foreground">Aucun ticket</p>
          <p className="mt-1 text-sm text-muted-foreground">{emptyLabel}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <TicketTableShell>
            {visible.map((t) => (
              <TableRow
                key={t.id}
                onClick={() => router.push(`/dashboard/tickets/${t.id}`)}
                className="cursor-pointer"
              >
                <TableCell className="py-4 pl-4">
                  <Link
                    href={`/dashboard/tickets/${t.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block truncate font-medium text-foreground hover:underline"
                  >
                    {t.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="block truncate text-sm text-muted-foreground">{clientName(t)}</span>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <span className={`size-2 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                    {PRIORITY_LABELS[t.priority]}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge className={`ring-1 ring-inset ${STATUS_BADGE[t.status]}`}>
                    {STATUS_LABELS[t.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    {t.assignee ? (
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarColor(t.assignee)}`}
                      >
                        {assigneeInitials(t.assignee)}
                      </span>
                    ) : (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/80 text-[11px] font-semibold text-background">
                        ?
                      </span>
                    )}
                    <span className={t.assignee ? "" : "text-muted-foreground"}>
                      {assigneeName(t.assignee)}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="pr-4 text-right text-sm text-muted-foreground tabular-nums">
                  {timeAgo(t.updated_at)}
                </TableCell>
              </TableRow>
            ))}
          </TicketTableShell>
        </div>
      )}
    </div>
  );
}

function TicketTableShell({ children }: { children: React.ReactNode }) {
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[40%] pl-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Sujet
          </TableHead>
          <TableHead className="w-[16%] text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Client
          </TableHead>
          <TableHead className="w-[12%] text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Priorité
          </TableHead>
          <TableHead className="w-[10%] text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Statut
          </TableHead>
          <TableHead className="w-[14%] text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Agent
          </TableHead>
          <TableHead className="w-[8%] pr-4 text-right text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Mis à jour
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
    </Table>
  );
}
