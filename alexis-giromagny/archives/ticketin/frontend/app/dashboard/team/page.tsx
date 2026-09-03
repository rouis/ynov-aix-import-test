"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

interface Member {
  id: string;
  email: string;
  firstname: string | null;
  lastname: string | null;
  role: "ADMIN" | "AGENT";
  status: "PENDING" | "ACTIVE";
}

export default function TeamPage() {
  const router = useRouter();
  const [me, setMe] = useState<{ sub: string } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listInfo, setListInfo] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      setMembers(await apiFetch<Member[]>("/user", { auth: true }));
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      router.replace("/dashboard");
      return;
    }
    setMe({ sub: user.sub });
    loadMembers();
  }, [loadMembers, router]);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormInfo(null);
    setSubmitting(true);
    try {
      await apiFetch("/user", { method: "POST", body: { email }, auth: true });
      setFormInfo(`Invitation envoyée à ${email}.`);
      setEmail("");
      await loadMembers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invitation impossible");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendInvitation(m: Member) {
    setListError(null);
    setListInfo(null);
    try {
      await apiFetch(`/user/${m.id}/resend-invitation`, { method: "POST", auth: true });
      setListInfo(`Invitation renvoyée à ${m.email}.`);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Renvoi impossible");
    }
  }

  async function deleteMember(m: Member) {
    if (!window.confirm(`Supprimer définitivement ${m.email} ?`)) return;
    setListError(null);
    setListInfo(null);
    try {
      await apiFetch(`/user/${m.id}`, { method: "DELETE", auth: true });
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Suppression impossible");
    }
  }

  if (!me) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Gestion d&apos;équipe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invitez des agents et gérez les rôles des membres de votre organisation.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Inviter un agent</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={invite} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemple@mail.com"
              />
            </div>
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "Envoi…" : "Inviter"}
            </Button>
          </form>
          {formError && <div className="mt-4"><Alert>{formError}</Alert></div>}
          {formInfo && <div className="mt-4"><Alert kind="success">{formInfo}</Alert></div>}
        </CardContent>
      </Card>

      <section>
        {listError && <div className="mb-4"><Alert>{listError}</Alert></div>}
        {listInfo && <div className="mb-4"><Alert kind="success">{listInfo}</Alert></div>}
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Chargement…</TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Aucun membre pour l&apos;instant.</TableCell>
                </TableRow>
              ) : (
                members.map((m) => {
                  const name = [m.firstname, m.lastname].filter(Boolean).join(" ");
                  const isSelf = m.id === me.sub;
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{name || "—"}</p>
                        <p className="text-muted-foreground">{m.email}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.role === "ADMIN" ? "default" : "secondary"}>
                          {m.role === "ADMIN" ? "Admin" : "Agent"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{m.status === "ACTIVE" ? "Actif" : "En attente"}</Badge>
                      </TableCell>
                      <TableCell className="space-x-2 text-right">
                        {m.status === "PENDING" && (
                          <Button variant="outline" size="sm" onClick={() => resendInvitation(m)}>
                            Renvoyer l&apos;invitation
                          </Button>
                        )}
                        {!isSelf && (
                          <Button variant="destructive" size="sm" onClick={() => deleteMember(m)}>
                            Retirer de l&apos;équipe
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
