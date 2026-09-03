"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { access_token } = await apiFetch<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setToken(access_token);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Connexion</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Bon retour</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Connectez-vous à votre espace technicien.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          {error && <Alert>{error}</Alert>}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">
              Adresse e-mail
            </Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@entreprise.fr"
              className="h-12 rounded-lg px-4 text-[15px]"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                Mot de passe
              </Label>
              <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="h-12 rounded-lg px-4 text-[15px]"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground select-none">
            <Checkbox
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked)}
            />
            Rester connecté sur ce poste
          </label>

          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-lg text-[15px] font-semibold"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Pas encore d&apos;organisation ?{" "}
          <Link href="/register-organization" className="font-medium text-primary hover:underline">
            Créer une organisation
          </Link>
        </p>
      </div>
    </div>
  );
}
