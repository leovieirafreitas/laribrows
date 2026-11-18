import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { db, services } from "@/lib/db";
import { clientProfile, getClientUser } from "@/lib/client-auth";
import { getSettings, mercadoPagoConfigured, publicSettings } from "@/lib/settings";
import { todayInStudio } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agendar horário" };

export default async function AgendarPage({ searchParams }: { searchParams: Promise<{ servico?: string }> }) {
  const { servico } = await searchParams;
  const [s, list] = await Promise.all([
    getSettings(),
    db
      .select({ id: services.id, name: services.name, description: services.description, durationMin: services.durationMin, priceCents: services.priceCents })
      .from(services)
      .where(eq(services.active, true))
      .orderBy(asc(services.sortOrder), asc(services.name)),
  ]);

  const client = await getClientUser();
  const prefill = client ? { ...(await clientProfile(client)), email: client.email } : null;

  const simulation =
    s.chargeMode !== "none" &&
    !mercadoPagoConfigured() &&
    (s.cardEnabled || (s.pixEnabled && !(s.pixProvider === "manual" && s.pixKey)));

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Agendamento online</p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">
          Reserve seu <em className="text-lavender-600">momento</em>
        </h1>
      </div>
      <BookingFlow
        services={list}
        settings={publicSettings(s)}
        initialServiceId={list.some((x) => x.id === servico) ? servico! : null}
        today={todayInStudio()}
        simulation={simulation}
        prefill={prefill}
      />
    </div>
  );
}
