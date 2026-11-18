import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "./AuthShell";
import { LoginForm } from "./LoginForm";
import { getAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false } };

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <AuthShell title="Bem-vinda de volta" text="Entre para gerenciar sua agenda.">
      <LoginForm />
    </AuthShell>
  );
}
