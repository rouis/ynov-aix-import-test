"use client";

import { ReactNode, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Inbox,
  LayoutGrid,
  LogOut,
  Settings,
  Ticket as TicketIcon,
  User,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { clearToken, getCurrentUser, type CurrentUser, type Role } from "@/lib/auth";
import { type Ticket } from "@/lib/tickets";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  AGENT: "Agent",
  CLIENT: "Client",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const current = getCurrentUser();
    if (!current) {
      router.replace("/login");
      return;
    }
    // Synchronisation d'un état externe (token localStorage) vers React au montage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(current);
  }, [router]);

  function logout() {
    clearToken();
    router.replace("/login");
  }

  if (!user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Suspense fallback={<aside className="w-64 shrink-0 border-r bg-card" />}>
        <Sidebar user={user} onLogout={logout} />
      </Suspense>

      <main className="min-w-0 flex-1 px-8 py-10">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}

function Sidebar({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const unassigned = searchParams.get("assignee") === "none";
  const onTickets = pathname.startsWith("/dashboard/tickets");

  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setTickets(await apiFetch<Ticket[]>("/ticket", { auth: true }));
      } catch {
        // Compteurs masqués si le chargement échoue.
      }
    })();
  }, []);

  const counts = useMemo(
    () => ({
      OPEN: tickets.filter((t) => t.status === "OPEN").length,
      IN_PROGRESS: tickets.filter((t) => t.status === "IN_PROGRESS").length,
      RESOLVE: tickets.filter((t) => t.status === "RESOLVE").length,
      unassigned: tickets.filter((t) => !t.assigned_to_id).length,
    }),
    [tickets]
  );

  const navItems = [
    { label: "Tableau de bord", href: "/dashboard", icon: LayoutGrid, active: pathname === "/dashboard" },
    {
      label: "Tous les tickets",
      href: "/dashboard/tickets",
      icon: TicketIcon,
      active: onTickets && !statusParam && !unassigned,
    },
    {
      label: "Mes tickets",
      href: "/dashboard/my-tickets",
      icon: User,
      active: pathname.startsWith("/dashboard/my-tickets"),
    },
    ...(user.role === "ADMIN"
      ? [
          {
            label: "Équipe",
            href: "/dashboard/team",
            icon: Users,
            active: pathname.startsWith("/dashboard/team"),
          },
        ]
      : []),
  ];

  const statusItems = [
    { label: "Ouverts", icon: CircleDot, color: "text-blue-500", href: "/dashboard/tickets?status=OPEN", count: counts.OPEN, active: onTickets && statusParam === "OPEN" },
    { label: "En cours", icon: CircleDashed, color: "text-amber-500", href: "/dashboard/tickets?status=IN_PROGRESS", count: counts.IN_PROGRESS, active: onTickets && statusParam === "IN_PROGRESS" },
    { label: "Résolus", icon: CheckCircle2, color: "text-emerald-500", href: "/dashboard/tickets?status=RESOLVE", count: counts.RESOLVE, active: onTickets && statusParam === "RESOLVE" },
    { label: "Non assignés", icon: Inbox, color: "text-muted-foreground", href: "/dashboard/tickets?assignee=none", count: counts.unassigned, active: onTickets && unassigned },
  ];

  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-card">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <TicketIcon className="size-5" />
        </span>
        <span className="text-lg font-bold tracking-tight text-foreground">Ticket&apos;in</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 text-sm">
        <p className="px-3 pt-3 pb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Navigation
        </p>
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors ${
                  item.active
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <p className="px-3 pt-5 pb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Filtrer par statut
        </p>
        <ul className="space-y-0.5">
          {statusItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors ${
                  item.active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className={`size-4 shrink-0 ${item.color}`} />
                <span className="flex-1">{item.label}</span>
                {item.count > 0 && (
                  <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                    {item.count}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        <p className="px-3 pt-5 pb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Tags
        </p>
        <p className="px-3 py-1 text-xs text-muted-foreground/60">Aucun tag pour le moment.</p>
      </nav>

      <div className="border-t px-3 py-3">
        <Link
          href="/dashboard/settings"
          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
            pathname.startsWith("/dashboard/settings")
              ? "bg-primary font-medium text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Settings className="size-4 shrink-0" />
          Paramètres
        </Link>
        <div className="mt-1 flex items-center gap-2.5 px-3 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Déconnexion"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
