import Link from "next/link";
import { asc, gte } from "drizzle-orm";
import { Plus } from "lucide-react";
import { AppointmentsBrowser } from "@/components/admin/AppointmentsBrowser";
import { PageHeader } from "@/components/admin/AppointmentItem";
import { cleanupExpired } from "@/lib/availability";
import { isHoldExpired } from "@/lib/booking";
import { appointments, db } from "@/lib/db";
import { addDays, todayInStudio } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agendamentos" };

export default async function AgendamentosPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  const { aba = "proximos", q = "" } = await searchParams;
  const today = todayInStudio();

  // Uma única ida ao banco: últimos 6 meses + todos os futuros. Abas e busca filtram no navegador.
  const [, rows] = await Promise.all([
    cleanupExpired(),
    db
      .select()
      .from(appointments)
      .where(gte(appointments.date, addDays(today, -183)))
      .orderBy(asc(appointments.date), asc(appointments.startMin))
      .limit(3000),
  ]);
  // Reservas que venceram sem pagamento aparecem já como expiradas.
  const list = rows.map((a) => (isHoldExpired(a) ? { ...a, status: "EXPIRED" as const } : a));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Gestão" title="Agendamentos">
        <Link href="/admin/agendamentos/novo" className="btn btn-primary btn-sm">
          <Plus className="size-4" /> Novo agendamento
        </Link>
      </PageHeader>
      <AppointmentsBrowser list={list} today={today} initialTab={aba} initialQuery={q} />
    </div>
  );
}
