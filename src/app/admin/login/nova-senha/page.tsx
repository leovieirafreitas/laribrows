import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../AuthShell";
import { NewPasswordForm } from "./NewPasswordForm";
import { adminFromResetToken, RESET_MINUTES } from "@/lib/password-reset";

export const dynamic = "force-dynamic";
// O link carrega o token: não repassa o endereço para outros sites.
export const metadata: Metadata = { title: "Nova senha", robots: { index: false }, referrer: "no-referrer" };

export default async function NovaSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const admin = await adminFromResetToken(token);

  if (!admin || !token) {
    return (
      <AuthShell title="Link expirado" text={`O link para criar uma senha nova vale por ${RESET_MINUTES} minutos e só pode ser usado uma vez.`}>
        <Link href="/admin/login/esqueci-senha" className="btn btn-primary mt-6 w-full">
          Pedir um novo link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nova senha" text={`Crie uma senha nova para ${admin.email}.`}>
      <NewPasswordForm token={token} email={admin.email} />
    </AuthShell>
  );
}
