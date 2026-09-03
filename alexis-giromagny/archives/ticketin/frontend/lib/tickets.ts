export type TicketStatus = "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVE" | "CLOSED";
export type TicketPriority = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Assignee {
  id: string;
  firstname: string | null;
  lastname: string | null;
  email: string;
}

export interface TicketAttachment {
  id: string;
  filename: string;
  contentType: string;
  url: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  requester_email: string;
  assigned_to_id: string | null;
  assignee: Assignee | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  attachments: TicketAttachment[];
  technician_note: string | null;
  reporter: { firstname: string | null; lastname: string | null; email: string } | null;
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  ON_HOLD: "En attente",
  RESOLVE: "Résolu",
  CLOSED: "Fermé",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  NONE: "Aucune",
  LOW: "Faible",
  MEDIUM: "Normale",
  HIGH: "Élevée",
  CRITICAL: "Critique",
};

export function assigneeName(a: Assignee | null): string {
  if (!a) return "Non assigné";
  const name = [a.firstname, a.lastname].filter(Boolean).join(" ");
  return name || a.email;
}

/** Couleur du point indiquant le statut (classes Tailwind bg-*). */
export const STATUS_DOT: Record<TicketStatus, string> = {
  OPEN: "bg-emerald-500",
  IN_PROGRESS: "bg-blue-500",
  ON_HOLD: "bg-amber-500",
  RESOLVE: "bg-violet-500",
  CLOSED: "bg-muted-foreground",
};

/** Couleur du point indiquant la priorité (classes Tailwind bg-*). */
export const PRIORITY_DOT: Record<TicketPriority, string> = {
  NONE: "bg-muted-foreground",
  LOW: "bg-slate-400",
  MEDIUM: "bg-blue-500",
  HIGH: "bg-amber-500",
  CRITICAL: "bg-red-500",
};

/** Pastille de statut (pill colorée). */
export const STATUS_BADGE: Record<TicketStatus, string> = {
  OPEN: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-400/20",
  IN_PROGRESS: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20",
  ON_HOLD: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20",
  RESOLVE: "bg-muted text-muted-foreground ring-border",
  CLOSED: "bg-muted text-muted-foreground ring-border",
};

/** Ordre de tri des priorités (plus haut = plus prioritaire). */
export const PRIORITY_RANK: Record<TicketPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  NONE: 0,
};

const CATEGORY_PALETTE = [
  "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
  "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400",
  "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-400",
];

/** Couleur stable d'un badge de catégorie, dérivée du libellé. */
export function categoryBadgeClass(category: string): string {
  let h = 0;
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length];
}

/** Initiales pour l'avatar de l'assigné. */
export function assigneeInitials(a: Assignee | null): string {
  if (!a) return "—";
  const init = `${a.firstname?.[0] ?? ""}${a.lastname?.[0] ?? ""}`.toUpperCase();
  return init || a.email[0]?.toUpperCase() || "?";
}

/** Hash entier stable d'une chaîne (FNV-like). */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Référence lisible d'un ticket, dérivée de la catégorie + de l'id.
 * Ex. « INC-4821 ». Faute de champ dédié côté backend, le numéro est un
 * hash stable de l'id (pas un compteur séquentiel).
 */
export function ticketRef(t: Pick<Ticket, "id" | "category">): string {
  const prefix = (t.category || "").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "TIC";
  const num = (hashString(t.id) % 9000) + 1000;
  return `${prefix}-${num}`;
}

const AVATAR_PALETTE = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-fuchsia-600",
  "bg-teal-600",
  "bg-indigo-600",
];

/** Couleur de fond stable de l'avatar d'un assigné. */
export function avatarColor(a: Assignee): string {
  return AVATAR_PALETTE[hashString(a.id || a.email) % AVATAR_PALETTE.length];
}

/**
 * Nom de client dérivé du domaine de l'e-mail du demandeur.
 * Ex. « contact@cabinet-mercier.fr » → « Cabinet Mercier ».
 * Donnée semi-réelle : le module Client n'existe pas encore côté backend.
 */
export function clientName(t: Pick<Ticket, "requester_email">): string {
  const domain = t.requester_email?.split("@")[1]?.split(".")[0];
  if (!domain) return "—";
  return domain
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * SLA dérivé (placeholder) : faute de champ d'échéance côté backend,
 * on simule un temps restant stable à partir de l'id, affiché uniquement
 * pour les priorités hautes/critiques. `urgent` => affichage rouge.
 */
export function sla(t: Pick<Ticket, "id" | "priority">): { label: string; urgent: boolean } | null {
  if (t.priority !== "CRITICAL" && t.priority !== "HIGH") return null;
  const minutes = hashString(t.id) % 240; // 0–4 h
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return { label: `${hh}:${mm}`, urgent: t.priority === "CRITICAL" };
}

/** Date longue FR avec heure, ex. « 12 juin 2026 à 12:00 ». */
export function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} à ${time}`;
}

/** Date relative compacte, ex. « il y a 2 h », « il y a 3 j ». */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  const months = Math.round(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  return `il y a ${Math.round(months / 12)} an(s)`;
}
