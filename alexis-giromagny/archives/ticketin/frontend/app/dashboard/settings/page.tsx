"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { clearToken, getCurrentUser, type CurrentUser, type Role } from "@/lib/auth";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  AGENT: "Agent",
  CLIENT: "Client",
};

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getCurrentUser());
  }, []);

  function logout() {
    clearToken();
    router.replace("/login");
  }

  if (!user) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez les informations de votre compte.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{user.email}</p>
              <Badge variant="secondary" className="mt-1">{ROLE_LABELS[user.role]}</Badge>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Adresse email</Label>
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Rôle</Label>
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {ROLE_LABELS[user.role]}
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Organisation</Label>
            <p className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
              {user.organizationId}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            La modification du profil et du mot de passe sera bientôt disponible.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={logout}>
            <LogOut className="size-4" />
            Déconnexion
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
