"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  STATUS_BADGE,
  STATUS_LABELS,
  assigneeName,
  formatDateFr,
  timeAgo,
  type Ticket,
  type TicketAttachment,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/tickets";

interface Member {
  id: string;
  email: string;
  firstname: string | null;
  lastname: string | null;
  role: "ADMIN" | "AGENT" | "CLIENT";
}

const UNASSIGNED = "none";

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [agents, setAgents] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const [status, setStatus] = useState<TicketStatus>("OPEN");
  const [priority, setPriority] = useState<TicketPriority>("NONE");
  const [assignedTo, setAssignedTo] = useState<string>(UNASSIGNED);
  const [note, setNote] = useState("");

  const isAgent = getCurrentUser()?.role !== "CLIENT";

  useEffect(() => {
    (async () => {
      try {
        const t = await apiFetch<Ticket>(`/ticket/${id}`, { auth: true });
        setTicket(t);
        setStatus(t.status);
        setPriority(t.priority);
        setAssignedTo(t.assigned_to_id ?? UNASSIGNED);
        setNote(t.technician_note ?? "");
        if (isAgent) {
          const members = await apiFetch<Member[]>("/user", { auth: true });
          setAgents(members.filter((m) => m.role !== "CLIENT"));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chargement impossible");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function patch(body: Record<string, unknown>, done: string) {
    setError(null);
    setInfo(null);
    const updated = await apiFetch<Ticket>(`/ticket/${id}`, { method: "PATCH", auth: true, body });
    setTicket(updated);
    setInfo(done);
  }

  async function saveDetails(e: FormEvent) {
    e.preventDefault();
    setSavingDetails(true);
    try {
      await patch(
        { status, priority, assigned_to_id: assignedTo === UNASSIGNED ? null : assignedTo },
        "Détails mis à jour.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible");
    } finally {
      setSavingDetails(false);
    }
  }

  async function saveNote(e: FormEvent) {
    e.preventDefault();
    setSavingNote(true);
    try {
      await patch({ technician_note: note }, "Note enregistrée.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setSavingNote(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!ticket) return <Alert>{error ?? "Ticket introuvable."}</Alert>;

  const r = ticket.reporter;
  const reporterName = r ? [r.firstname, r.lastname].filter(Boolean).join(" ") || r.email : ticket.requester_email;
  const reporterInitials =
    r && (r.firstname || r.lastname)
      ? `${r.firstname?.[0] ?? ""}${r.lastname?.[0] ?? ""}`.toUpperCase()
      : reporterName.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/tickets"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Tickets
      </Link>

      {error && <Alert>{error}</Alert>}
      {info && <Alert kind="success">{info}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{ticket.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge className={`ring-1 ring-inset ${STATUS_BADGE[ticket.status]}`}>
                {STATUS_LABELS[ticket.status]}
              </Badge>
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <span className={`size-2 rounded-full ${PRIORITY_DOT[ticket.priority]}`} />
                {PRIORITY_LABELS[ticket.priority]}
              </span>
              <span className="text-muted-foreground">· {ticket.category}</span>
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Note du technicien</CardTitle>
            </CardHeader>
            <CardContent>
              {isAgent ? (
                <form onSubmit={saveNote} className="space-y-3">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ajouter une note interne (diagnostic, résolution…)"
                    className="min-h-32"
                  />
                  <Button type="submit" disabled={savingNote}>
                    {savingNote ? "Enregistrement…" : "Enregistrer la note"}
                  </Button>
                </form>
              ) : ticket.technician_note ? (
                <p className="whitespace-pre-wrap text-sm text-foreground">{ticket.technician_note}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune note du technicien.</p>
              )}
            </CardContent>
          </Card>

          {ticket.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pièces jointes ({ticket.attachments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {ticket.attachments.map((a) => (
                    <AttachmentThumb key={a.id} att={a} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="lg:col-span-1">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle>Détails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAgent ? (
                <form onSubmit={saveDetails} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="status">Statut</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus)}>
                      <SelectTrigger id="status" className="w-full">
                        <SelectValue>{(value) => (value ? STATUS_LABELS[value as TicketStatus] : "")}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="priority">Priorité</Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                      <SelectTrigger id="priority" className="w-full">
                        <SelectValue>{(value) => (value ? PRIORITY_LABELS[value as TicketPriority] : "")}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="assignee">Assigné à</Label>
                    <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v ?? UNASSIGNED)}>
                      <SelectTrigger id="assignee" className="w-full">
                        <SelectValue>
                          {(value) => {
                            if (!value || value === UNASSIGNED) return "Non assigné";
                            const a = agents.find((m) => m.id === value);
                            return a ? [a.firstname, a.lastname].filter(Boolean).join(" ") || a.email : "Non assigné";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Non assigné</SelectItem>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {[a.firstname, a.lastname].filter(Boolean).join(" ") || a.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={savingDetails} className="w-full">
                    {savingDetails ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                </form>
              ) : (
                <dl className="space-y-3 text-sm">
                  <DetailField label="Statut">
                    <Badge className={`ring-1 ring-inset ${STATUS_BADGE[ticket.status]}`}>
                      {STATUS_LABELS[ticket.status]}
                    </Badge>
                  </DetailField>
                  <DetailField label="Priorité">
                    <span className="flex items-center gap-1.5">
                      <span className={`size-2 rounded-full ${PRIORITY_DOT[ticket.priority]}`} />
                      {PRIORITY_LABELS[ticket.priority]}
                    </span>
                  </DetailField>
                  <DetailField label="Assigné à">{assigneeName(ticket.assignee)}</DetailField>
                </dl>
              )}

              <div className="space-y-3 border-t pt-4 text-sm">
                <DetailField label="Rapporté par">
                  <span className="flex items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {reporterInitials}
                    </span>
                    <span className="truncate">{reporterName}</span>
                  </span>
                </DetailField>
                <DetailField label="Créé">{formatDateFr(ticket.created_at)}</DetailField>
                <DetailField label="Mis à jour">{timeAgo(ticket.updated_at)}</DetailField>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

function AttachmentThumb({ att }: { att: TicketAttachment }) {
  const [broken, setBroken] = useState(false);
  return (
    <a href={att.url} target="_blank" rel="noreferrer" className="block">
      {broken ? (
        <div className="flex aspect-square w-full items-center justify-center rounded-lg border bg-muted p-2 text-center text-xs text-muted-foreground">
          {att.filename}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={att.url}
          alt={att.filename}
          className="aspect-square w-full rounded-lg border object-cover"
          onError={() => setBroken(true)}
        />
      )}
    </a>
  );
}
