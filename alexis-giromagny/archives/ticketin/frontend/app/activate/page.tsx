"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { setToken } from "@/lib/auth";

function ActivateForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [status, setStatus] = useState<"loading" | "valid" | "invalid">("loading");
  const [account, setAccount] = useState<{ email: string; role: string } | null>(null);
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    apiFetch<{ email: string; role: string }>(`/auth/activation/${token}`)
      .then((data) => {
        setAccount(data);
        setStatus("valid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { access_token } = await apiFetch<{ access_token: string }>("/auth/activate", {
        method: "POST",
        body: { token, firstname, lastname, password },
      });
      setToken(access_token);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation impossible");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <AuthShell title="Activation du compte">
        <p className="text-center text-sm text-muted-foreground">Vérification du lien…</p>
      </AuthShell>
    );
  }

  if (status === "invalid") {
    return (
      <AuthShell
        title="Lien invalide"
        footer={
          <Link href="/login" className="font-medium text-primary hover:underline">
            Retour à la connexion
          </Link>
        }
      >
        <Alert>Ce lien d&apos;activation est invalide ou expiré. Demandez à votre administrateur de vous en renvoyer un.</Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Activez votre compte" subtitle={`${account?.email} · rôle ${account?.role}`}>
      <form onSubmit={onSubmit} className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="firstname">Prénom</Label>
            <Input id="firstname" required value={firstname} onChange={(e) => setFirstname(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lastname">Nom</Label>
            <Input id="lastname" required value={lastname} onChange={(e) => setLastname(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 caractères minimum"
          />
        </div>
        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? "Activation…" : "Activer et se connecter"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Activation du compte">
          <p className="text-center text-sm text-muted-foreground">Chargement…</p>
        </AuthShell>
      }
    >
      <ActivateForm />
    </Suspense>
  );
}
