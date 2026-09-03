"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";

  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "done">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    apiFetch<{ email: string }>(`/auth/reset-password/${token}`)
      .then((data) => {
        setEmail(data.email);
        setStatus("valid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/reset-password", { method: "POST", body: { token, password } });
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Réinitialisation impossible");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <AuthShell title="Réinitialisation du mot de passe">
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
        <div className="space-y-4">
          <Alert>Ce lien de réinitialisation est invalide ou expiré.</Alert>
          <Link href="/forgot-password" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
            Renvoyer un lien
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (status === "done") {
    return (
      <AuthShell title="Mot de passe mis à jour">
        <div className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Votre mot de passe a bien été modifié. Vous pouvez maintenant vous connecter.
          </p>
          <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
            Se connecter
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nouveau mot de passe" subtitle={email ?? undefined}>
      <form onSubmit={onSubmit} className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-2">
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 caractères minimum"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm">Confirmer le mot de passe</Label>
          <Input
            id="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? "Enregistrement…" : "Réinitialiser le mot de passe"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Réinitialisation du mot de passe">
          <p className="text-center text-sm text-muted-foreground">Chargement…</p>
        </AuthShell>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
