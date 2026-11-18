import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, inArray } from "drizzle-orm";
import { ArrowLeft, CalendarPlus, Mail, MessageCircle, Phone } from "lucide-react";
import { AppointmentItem, PageHeader } from "@/components/admin/AppointmentItem";
import { getClients } from "@/lib/clients";
import { appointments, db } from "@/lib/db";
import { formatBRL, formatPhone, whatsappLink } from "@/lib/format";
import { formatDateShort, formatStudioDateTime, nowInStudio } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cliente" };

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = (await getClients()).find((c) => c.id === id);
  if (!client) notFound();

  const list = client.appointmentIds.length
    ? await db
        .select()
        .from(appointments)
        .where(inArray(appointments.id, client.appointmentIds))
        .orderBy(desc(appointments.date), desc(appointments.startMin))
    : [];
  const now = nowInStudio();
  const isFuture = (a: (typeof list)[number]) => a.date > now.date || (a.date === now.date && a.endMin > now.minutes);
  const upcoming = list.filter((a) => isFuture(a) && !["CANCELLED", "EXPIRED"].includes(a.status)).reverse();
  const history = list.filter((a) => !upcoming.includes(a));

  const firstName = client.name.split(" ")[0];
  const wa = client.phone ? whatsappLink(client.phone, `Olá, ${firstName}! Aqui é do studio Lari Brows 💜`) : "";
  const newHref = `/admin/agendamentos/novo?${new URLSearchParams({ nome: client.name, tel: client.phone, email: client.email })}`;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/clientes" className="mb-4 inline-flex items-center gap-1.5 text-xs tracking-wide text-plum-600/70 hover:text-plum-900">
        <ArrowLeft className="size-3.5" /> Clientes
      </Link>
      <PageHeader eyebrow="Cliente" title={client.name}>
        <Link href={newHref} className="btn btn-primary btn-sm">
          <CalendarPlus className="size-4" /> Novo agendamento
        </Link>
      </PageHeader>

      {/* Contato */}
      <div className="card -mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 p-5">
        {client.phone && (
          <span className="flex items-center gap-2 text-sm text-plum-800">
            <Phone className="size-4 text-lavender-500" /> {formatPhone(client.phone)}
          </span>
        )}
        {client.email && (
          <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-plum-800 hover:text-lavender-700">
            <Mail className="size-4 text-lavender-500" /> {client.email}
          </a>
        )}
        <span className="flex flex-wrap gap-2">
          {client.hasAccount && <span className="rounded-full bg-lavender-100 px-2.5 py-1 text-[0.68rem] tracking-wide text-lavender-700">Conta no site</span>}
        </span>
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm ml-auto">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        )}
      </div>

      {/* Números */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Info label="Atendimentos" value={String(client.visits)} hint={client.cancelled ? `${client.cancelled} cancelado(s)` : undefined} />
        <Info label="Total pago" value={formatBRL(client.paidCents)} />
        <Info label="Cliente desde" value={formatDateShort(nowInStudio(new Date(client.firstSeen)).date)} />
        <Info
          label="Área da cliente"
          value={client.hasAccount ? "Tem conta" : "Sem conta"}
          hint={client.lastSignIn ? `Último acesso: ${formatStudioDateTime(new Date(client.lastSignIn))}` : undefined}
        />
      </div>

      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-2xl">Próximos horários</h2>
          <div className="card mt-3 p-2">
            {upcoming.map((a) => (
              <AppointmentItem key={a.id} a={a} showDate />
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-2xl">Histórico</h2>
        <div className="card mt-3 p-2">
          {history.length === 0 ? (
            <p className="p-8 text-center text-sm text-plum-600/70">
              {client.hasAccount && !list.length ? "Criou conta no site, mas ainda não agendou." : "Nenhum atendimento anterior."}
            </p>
          ) : (
            history.map((a) => <AppointmentItem key={a.id} a={a} showDate />)
          )}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs tracking-wide text-plum-600/70">{label}</p>
      <p className="mt-2 font-display text-2xl text-plum-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-plum-600/50">{hint}</p>}
    </div>
  );
}
