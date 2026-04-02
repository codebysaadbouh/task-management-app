"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerUser } from "@/server/actions/auth.actions";
import { LayoutGrid } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await registerUser({ email, password });
        if (!result.success) {
          if (result.code === "CONFLICT") {
            setError("Un compte avec cet email existe déjà");
          } else if (result.code === "VALIDATION_ERROR") {
            setError(result.error);
          } else {
            toast.error("Une erreur inattendue s'est produite");
          }
        } else {
          toast.success("Compte créé avec succès !");
          router.push("/login");
        }
      } catch {
        toast.error("Une erreur inattendue s'est produite");
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">TaskBoard</h1>
          <p className="text-sm text-muted-foreground">Créez votre compte gratuitement</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isPending}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isPending}
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">Au moins 8 caractères</p>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-10" disabled={isPending}>
              {isPending ? "Création…" : "Créer un compte"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline underline-offset-4">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
