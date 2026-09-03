"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

export default function RegisterOrganizationPage() {
  const [organizationName, setOrganizationName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/auth/register-organization", {
        method: "POST",
        body: { organizationName, adminEmail },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthShell
        title="Vérifiez vos emails"
        subtitle="Votre organisation a été créée"
        footer={
          <Link href="/login" className="font-medium text-primary hover:underline">
            Retour à la connexion
          </Link>
        }
      >
        <Alert kind="success">
          Un lien d&apos;activation a été envoyé à <strong>{adminEmail}</strong>. Suivez-le pour
          définir votre nom et votre mot de passe.
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Créer une organisation"
      subtitle="Vous en serez le premier administrateur"
      footer={
        <>
          Vous avez déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-2">
          <Label htmlFor="org">Nom de l&apos;organisation</Label>
          <Input
            id="org"
            required
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder="Acme Corp"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email de l&apos;administrateur</Label>
          <Input
            id="email"
            type="email"
            required
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@acme.com"
          />
        </div>
        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? "Création…" : "Créer l'organisation"}
        </Button>
      </form>
    </AuthShell>
  );
}
