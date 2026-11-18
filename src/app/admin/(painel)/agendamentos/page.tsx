import Link from "next/link";
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, type SQL } from "drizzle-orm";
import { Plus, Search } from "lucide-react";
import { AppointmentItem, PageHeader } from "@/components/admin/AppointmentItem";
import { cleanupExpired } from "@/lib/availability";
import { appointments, db } from "@/lib/db";
import { todayInStudio } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agendamentos" };

const TABS = [
  { key: "proximos", label: "Próximos" },
  { key: "conferir", label: "PIX para conferir" },
  { key: "pagamento", label: "Aguardando pagamento" },
  { key: "passados", label: "Passados" },
  { key: "cancelados", label: "Cancelados" },
  { key: "todos", label: "Todos" },
] as const;

export default async function AgendamentosPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  const { aba = "proximos", q = "" } = await searchParams;
  await cleanupExpired();
  const today = todayInStudio();

  const where: (SQL | undefined)[] = [];
  let order = [asc(appointments.date), asc(appointments.startMin)];
  switch (aba) {
    case "conferir":
      where.push(eq(appointments.status, "AWAITING_CONFIRMATION"));
      break;
    case "pagamento":
      where.push(eq(appointments.status, "PENDING_PAYMENT"));
      break;
    case "passados":
      where.push(lt(appointments.date, today), inArray(appointments.status, ["CONFIRMED", "COMPLETED", "NO_SHOW"]));
      order = [desc(appointments.date), desc(appointments.startMin)];
      break;
    case "cancelados":
      where.push(inArray(appointments.status, ["CANCELLED", "EXPIRED"]));
      order = [desc(appointments.date), desc(appointments.startMin)];
      break;
    case "todos":
      order = [desc(appointments.date), desc(appointments.startMin)];
      break;
    default:
      where.push(gte(appointments.date, today), inArray(appointments.status, ["CONFIRMED", "AWAITING_CONFIRMATION", "PENDING_PAYMENT", "COMPLETED"]));
  }
  const term = q.trim();
  if (term) {
    const pattern = `%${term}%`;
    where.push(or(ilike(appointments.clientName, pattern), ilike(appointments.clientPhone, pattern), ilike(appointments.code, pattern)));
  }

  const list = await db
    .select()
    .from(appointments)
    .where(and(...where))
    .orderBy(...order)
    .limit(200);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Gestão" title="Agendamentos">
        <Link href="/admin/agendamentos/novo" className="btn btn-primary btn-sm">
          <Plus className="size-4" /> Novo agendamento
        </Link>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-card">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/agendamentos?aba=${t.key}${term ? `&q=${encodeURIComponent(term)}` : ""}`}
              className={`rounded-full px-4 py-2 text-xs tracking-wide transition ${aba === t.key ? "bg-plum-900 text-white" : "text-plum-700 hover:bg-lavender-100"}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form className="relative ml-auto w-full sm:w-64">
          <input type="hidden" name="aba" value={aba} />
          <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-plum-600/40" />
          <input name="q" defaultValue={term} placeholder="Nome, telefone ou código" className="field rounded-full py-2.5 pl-10 text-sm" />
        </form>
      </div>

      <section className="card mt-6 p-3 sm:p-4">
        {list.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-plum-600/70">Nenhum agendamento por aqui.</p>
        ) : (
          <div className="divide-y divide-lavender-100/70">
            {list.map((a) => (
              <AppointmentItem key={a.id} a={a} showDate />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
