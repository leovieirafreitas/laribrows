import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { db, services } from "@/lib/db";
import { clientProfile, getClientUser } from "@/lib/client-auth";
import { servicePrice } from "@/lib/pricing";
import { availableMethods, getSettings, promoOf, publicSettings } from "@/lib/settings";
import { todayInStudio } from "@/lib/time";
import { turnstileSiteKey } from "@/lib/env";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agendar horário" };

/** Avisos de quando a cliente confirma o e-mail pelo botão do e-mail (ver agendar/r/.../confirm). */
const AVISOS: Record<string, string> = {
  horario: "Seu e-mail foi confirmado, mas esse horário acabou de ser reservado por outra pessoa. Escolha outro, por favor.",
  erro: "Seu e-mail foi confirmado, mas não conseguimos gerar o pagamento. Tente de novo abaixo.",
  refazer: "E-mail confirmado! O pedido anterior expirou: escolha o horário de novo para concluir.",
};

export default async function AgendarPage({ searchParams }: { searchParams: Promise<{ servico?: string; aviso?: string }> }) {
  const { servico, aviso } = await searchParams;
  const [s, rows] = await Promise.all([
    getSettings(),
    db
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        durationMin: services.durationMin,
        priceCents: services.priceCents,
        promoPriceCents: services.promoPriceCents,
      })
      .from(services)
      .where(eq(services.active, true))
      .orderBy(asc(services.sortOrder), asc(services.name)),
  ]);

  const today = todayInStudio();
  const list = rows.map(({ promoPriceCents, ...svc }) => ({ ...svc, ...servicePrice({ priceCents: svc.priceCents, promoPriceCents }, promoOf(s), today) }));

  const client = await getClientUser();
  const prefill = client ? { ...(await clientProfile(client)), email: client.email } : null;

  const simulation = s.chargeMode !== "none" && availableMethods(s).simulation;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Agendamento online</p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">
          Reserve seu <em className="text-lavender-600">momento</em>
        </h1>
      </div>
      {aviso && AVISOS[aviso] && (
        <div className="mt-8 max-w-2xl">
          <Notice tone={aviso === "refazer" ? "success" : "warn"}>{AVISOS[aviso]}</Notice>
        </div>
      )}
      <BookingFlow
        services={list}
        settings={publicSettings(s)}
        initialServiceId={list.some((x) => x.id === servico) ? servico! : null}
        today={todayInStudio()}
        simulation={simulation}
        prefill={prefill}
        turnstileSiteKey={client ? "" : turnstileSiteKey()}
      />
    </div>
  );
}
