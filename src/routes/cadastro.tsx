import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { PasswordStrength } from "@/components/PasswordStrength";
import { ptValidation } from "@/lib/validation-messages";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastre-se — Clinik.Club" },
      { name: "description", content: "Crie sua conta na Clinik.Club e comece a transformar tráfego em pacientes com funis interativos." },
      { property: "og:title", content: "Cadastre-se — Clinik.Club" },
      { property: "og:description", content: "Crie sua conta e publique funis interativos para sua clínica em minutos." },
      { property: "og:url", content: "https://clinik.club/cadastro" },
    ],
    links: [
      { rel: "canonical", href: "https://clinik.club/cadastro" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    email: typeof s.email === "string" ? s.email : undefined,
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: CadastroPage,
});

function CadastroPage() {
  const navigate = useNavigate();
  const { email: prefEmail, next } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [weakPasswordOpen, setWeakPasswordOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const emailValue = String(fd.get("email"));
    const { error } = await supabase.auth.signUp({
      email: emailValue,
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: window.location.origin + (next || "/app"),
        data: { name: String(fd.get("name")) },
      },
    });
    setLoading(false);
    if (error) {
      const msg = error.message;
      const lower = msg.toLowerCase();
      const isWeak =
        lower.includes("weak") ||
        lower.includes("pwned") ||
        lower.includes("password is known") ||
        lower.includes("compromised") ||
        lower.includes("easy to guess");
      if (isWeak) {
        setWeakPasswordOpen(true);
      } else {
        toast.error(msg);
      }
      return;
    }
    toast.success("Cadastro realizado! Verifique seu email para confirmar.");
    setPendingEmail(emailValue);
  }

  async function resendConfirmation() {
    if (!pendingEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: pendingEmail });
      if (error) toast.error("Não foi possível reenviar agora. Tente em alguns instantes.");
      else toast.success("Email de confirmação reenviado.");
    } finally {
      setResending(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + (next || "/app") });
    if (result.error) toast.error("Erro ao cadastrar com Google");
    if (!result.redirected && !result.error) navigate({ to: (next as never) || "/app" });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-md">
        <h1 className="text-4xl font-black tracking-tight">Criar conta</h1>
        {pendingEmail ? (
          <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm">
            <h2 className="font-bold text-base">Confirme seu email</h2>
            <p className="mt-1 text-muted-foreground">
              Enviamos um link de confirmação para <span className="font-semibold text-foreground">{pendingEmail}</span>. Clique no link para ativar sua conta.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" className="rounded-full" onClick={resendConfirmation} disabled={resending}>
                {resending ? "Reenviando..." : "Reenviar email"}
              </Button>
              <Button type="button" className="rounded-full" onClick={() => navigate({ to: "/login", search: next ? ({ next } as never) : undefined })}>
                Ir para login
              </Button>
            </div>
          </div>
        ) : (
        <>
        <Button variant="outline" className="mt-8 w-full rounded-full h-11" onClick={google}>Cadastrar com Google</Button>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><div className="flex-1 h-px bg-border" />ou<div className="flex-1 h-px bg-border" /></div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div><Label htmlFor="name">Nome</Label><Input id="name" name="name" required className="mt-1.5" {...ptValidation("nome")} /></div>
          <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required className="mt-1.5" defaultValue={prefEmail} readOnly={!!prefEmail} {...ptValidation("email")} /></div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" minLength={8} required className="mt-1.5" value={password} onChange={(e) => setPassword(e.target.value)} {...ptValidation("senha")} />
            <PasswordStrength password={password} />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-full h-11 font-semibold">{loading ? "Criando..." : "Criar conta"}</Button>
        </form>
        <p className="mt-6 text-sm text-center text-muted-foreground">
          Já tem conta? <Link to="/login" className="text-primary font-medium">Entrar</Link>
        </p>
        </>
        )}
      </main>
      <AlertDialog open={weakPasswordOpen} onOpenChange={setWeakPasswordOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" aria-hidden="true" />
            </div>
            <AlertDialogTitle className="text-center">Senha insegura detectada</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Essa senha já apareceu em vazamentos públicos de dados e não pode ser usada para proteger sua conta — mesmo que cumpra os requisitos de tamanho e caracteres.
              <br /><br />
              <strong>O que fazer:</strong> escolha uma senha <strong>única</strong>, que você nunca tenha usado em outros sites. Combine letras maiúsculas, minúsculas, números e símbolos, e evite nomes próprios, datas e palavras comuns.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="w-full"
              onClick={() => {
                setPassword("");
                setTimeout(() => document.getElementById("password")?.focus(), 50);
              }}
            >
              Escolher outra senha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
