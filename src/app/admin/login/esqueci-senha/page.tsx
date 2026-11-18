import type { Metadata } from "next";
import { AuthShell } from "../AuthShell";
import { ForgotForm } from "./ForgotForm";

export const metadata: Metadata = { title: "Esqueci minha senha", robots: { index: false } };

export default function EsqueciSenhaPage() {
  return (
    <AuthShell title="Esqueci minha senha" text="Digite o e-mail do painel. Enviamos um link para você criar uma senha nova.">
      <ForgotForm />
    </AuthShell>
  );
}
