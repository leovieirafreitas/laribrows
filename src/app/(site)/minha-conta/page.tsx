import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { CalendarPlus, Clock, LogOut, MessageCircle } from "lucide-react";
import { signOutAction } from "./actions";
import { CancelButton, ProfileForm } from "./client";
import { StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { clientProfile, requireCompleteClient } from "@/lib/client-auth";
import { changePolicy, splitAppointments } from "@/lib/client-booking";
import { appointments, db, type Appointment, type Settings } from "@/lib/db";
import { formatBRL, whatsappLink } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { formatDateLong, minToTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minha conta", robots: { index: false } };

export default async function MinhaContaPage() {
  const user = await requireCompleteClient("/minha-conta");
  const [s, list, profile] = await Promise.all([
    getSettings(),
    db.select().from(appointments).where(eq(appointments.clientEmail, user.email)).orderBy(desc(appointments.date), desc(appointments.startMin)),
    clientProfile(user),
  ]);

  const { upcoming, history } = splitAppointments(list);
  const firstName = (profile.name || "").split(" ")[0];

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Área da cliente</p>
          <h1 className="display mt-3 text-5xl">
            Olá{firstName ? "," : ""} <em className="text-lavender-600">{firstName || "bem-vinda"}</em>
          </h1>
          <p className="mt-2 text-sm text-plum-600/70">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/agendar" className="btn btn-primary btn-sm">
            <CalendarPlus className="size-4" /> Novo agendamento
          </Link>
          <form action={signOutAction}>
            <SubmitButton className="btn btn-outline btn-sm">
              <LogOut className="size-4" /> Sair
            </SubmitButton>
          </form>
        </div>
      </div>

      {/* Próximos */}
      <section className="mt-10">
        <h2 className="font-display text-3xl">Próximos horários</h2>
        {upcoming.length === 0 ? (
          <div className="card mt-4 p-8 text-center">
            <p className="text-plum-700/80">Você não tem horários marcados.</p>
            <Link href="/agendar" className="btn btn-soft btn-sm mt-4">
              Agendar agora
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {upcoming.map((a) => (
              <UpcomingCard key={a.id} a={a} s={s} />
            ))}
          </div>
        )}
        <p className="mt-4 text-xs leading-relaxed text-plum-600/60">
          Você pode cancelar ou remarcar por aqui até {s.clientChangeHours}h antes do horário. {s.cancellationPolicy}
        </p>
      </section>

      {/* Histórico */}
      {history.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-3xl">Histórico</h2>
          <ul className="card mt-4 divide-y divide-lavender-100">
            {history.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-plum-900">{a.serviceName}</p>
                  <p className="text-sm text-plum-600/70">
                    {formatDateLong(a.date)} · {minToTime(a.startMin)}
                  </p>
                </div>
                <StatusBadge status={a.status} />
                <Link href={`/agendar?servico=${a.serviceId}`} className="btn btn-ghost btn-sm">
                  Agendar de novo
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Dados */}
      <section className="mt-12">
        <h2 className="font-display text-3xl">Meus dados</h2>
        <div className="card mt-4 p-6">
          <ProfileForm name={profile.name} phone={profile.phone} email={user.email} />
        </div>
      </section>
    </div>
  );
}

function UpcomingCard({ a, s }: { a: Appointment; s: Settings }) {
  const policy = changePolicy(a, s);
  const remaining = a.totalCents - a.paidCents;
  const day = Number(a.date.slice(8));
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(new Date(`${a.date}T12:00:00Z`)).replace(".", "");
  const wa = whatsappLink(s.whatsapp, `Olá! Preciso de ajuda com meu agendamento ${a.code} (${a.serviceName}, ${formatDateLong(a.date)} às ${minToTime(a.startMin)}).`);

  return (
    <article className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
      <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl bg-plum-900 px-5 py-3 text-white sm:w-24">
        <span className="font-display text-4xl leading-none">{day}</span>
        <span className="mt-1 text-[0.65rem] tracking-[0.25em] text-lavender-200 uppercase">{month}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-2xl leading-tight">{a.serviceName}</h3>
          <StatusBadge status={a.status} />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-plum-700/80">
          <Clock className="size-3.5" /> {formatDateLong(a.date)}, às {minToTime(a.startMin)} (Manaus)
        </p>
        <p className="mt-1 text-xs text-plum-600/70">
          {a.paidCents > 0 ? `Pago ${formatBRL(a.paidCents)}` : "Nada pago ainda"}
          {remaining > 0 ? ` · restante ${formatBRL(remaining)}` : " · quitado"}
        </p>
        {policy.tooLate && (
          <p className="mt-2 text-xs text-champagne-600">
            Faltam menos de {s.clientChangeHours}h — para mudanças,{" "}
            {wa ? (
              <a href={wa} target="_blank" rel="noreferrer" className="underline">
                fale com o studio
              </a>
            ) : (
              "fale com o studio"
            )}
            .
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
        {a.status === "PENDING_PAYMENT" ? (
          <Link href={`/agendamento/${a.id}`} className="btn btn-primary btn-sm">
            Pagar agora
          </Link>
        ) : (
          <Link href={`/agendamento/${a.id}`} className="btn btn-outline btn-sm">
            Detalhes
          </Link>
        )}
        {policy.canReschedule && (
          <Link href={`/minha-conta/remarcar/${a.id}`} className="btn btn-soft btn-sm">
            Remarcar
          </Link>
        )}
        {policy.canCancel && <CancelButton appointmentId={a.id} paid={a.paidCents > 0} />}
        {policy.tooLate && wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        )}
      </div>
    </article>
  );
}
