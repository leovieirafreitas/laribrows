import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompleteProfileForm } from "./CompleteProfileForm";
import { Ornament } from "@/components/brand/Ornament";
import { clientProfile, hasCompleteProfile, requireClientUser } from "@/lib/client-auth";
import { formatPhone } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Complete seu cadastro", robots: { index: false } };

/** Primeiro acesso à área da cliente: pede nome completo e WhatsApp antes de seguir. */
export default async function CompletarCadastroPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await requireClientUser();
  const { next: raw = "" } = await searchParams;
  const next = /^\/(?![/\\])/.test(raw) && !raw.startsWith("/minha-conta/completar") ? raw : "/minha-conta";
  if (await hasCompleteProfile(user)) redirect(next);

  // Quem já agendou antes chega com os campos preenchidos (só confirma).
  const known = await clientProfile(user);

  return (
    <div className="mx-auto max-w-md px-5 py-14 sm:py-20">
      <div className="text-center">
        <p className="eyebrow">Área da cliente</p>
        <h1 className="display mt-3 text-5xl">
          Quase <em className="text-lavender-600">lá</em>
        </h1>
        <p className="mt-3 text-plum-700/80">
          Só na primeira vez: confirme seu nome e WhatsApp para o studio falar com você sobre seus horários.
        </p>
        <Ornament className="mx-auto mt-6 text-champagne-500" />
      </div>
      <div className="card mt-8 p-6 sm:p-8">
        <CompleteProfileForm name={known.name} phone={formatPhone(known.phone)} email={user.email} next={next} />
      </div>
    </div>
  );
}
