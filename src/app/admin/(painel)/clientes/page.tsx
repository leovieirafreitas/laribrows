import { PageHeader } from "@/components/admin/AppointmentItem";
import { ClientsBrowser, type ClientRow } from "@/components/admin/ClientsBrowser";
import { getClients, isRealClient } from "@/lib/clients";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clientes" };

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  const [{ aba = "todas", q = "" }, clients] = await Promise.all([searchParams, getClients()]);
  const list: ClientRow[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    bookings: c.bookings,
    visits: c.visits,
    abandoned: c.abandoned,
    paidCents: c.paidCents,
    lastVisit: c.lastVisit,
    next: c.next,
    hasAccount: c.hasAccount,
    isNew: c.isNew,
    real: isRealClient(c),
  }));
  const total = list.filter((c) => c.real).length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Gestão" title={<>Clientes {total > 0 && <span className="text-lavender-600 tabular-nums">· {total}</span>}</>} />
      <p className="-mt-4 mb-6 text-sm text-plum-600/70">Quem agendou pelo site ou pelo painel e quem criou conta na área da cliente.</p>
      <ClientsBrowser list={list} initialTab={aba} initialQuery={q} />
    </div>
  );
}
