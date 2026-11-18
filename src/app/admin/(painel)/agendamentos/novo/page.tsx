import Link from "next/link";
import { asc } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { createManualAppointmentAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/AppointmentItem";
import { SubmitButton } from "@/components/ui/client";
import { DateField, SelectField, TimeField } from "@/components/ui/pickers";
import { db, services } from "@/lib/db";
import { formatBRL } from "@/lib/format";
import { todayInStudio } from "@/lib/time";
import { whatsappConfigured } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novo agendamento" };

export default async function NovoAgendamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; nome?: string; tel?: string; email?: string }>;
}) {
  const { data, nome = "", tel = "", email = "" } = await searchParams;
  const list = await db.select().from(services).orderBy(asc(services.sortOrder), asc(services.name));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/agendamentos" className="mb-4 inline-flex items-center gap-1.5 text-xs tracking-wide text-plum-600/70 hover:text-plum-900">
        <ArrowLeft className="size-3.5" /> Agendamentos
      </Link>
      <PageHeader eyebrow="Lançamento manual" title="Novo agendamento" />
      <p className="-mt-4 mb-6 text-sm text-plum-600/70">Para clientes que marcaram pelo WhatsApp, Instagram ou no balcão. Entra como confirmado.</p>

      <ActionForm action={createManualAppointmentAction} className="card space-y-5 p-6 sm:p-8">
        <div>
          <label className="label">Procedimento</label>
          <SelectField
            name="serviceId"
            ariaLabel="Procedimento"
            panelClassName="w-[22rem]"
            options={list.map((s) => ({ value: s.id, label: s.name, hint: `${formatBRL(s.priceCents)} · ${s.durationMin} min${s.active ? "" : " · inativo"}` }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Data</label>
            <DateField name="date" defaultValue={data ?? todayInStudio()} />
          </div>
          <div>
            <label className="label">Horário</label>
            <TimeField name="time" defaultValue="09:00" align="right" ariaLabel="Horário" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nome da cliente</label>
            <input name="clientName" required className="field" defaultValue={nome} />
          </div>
          <div>
            <label className="label">WhatsApp</label>
            <input name="clientPhone" required className="field" inputMode="tel" placeholder="(92) 98765-4321" defaultValue={tel} />
          </div>
          <div>
            <label className="label">E-mail (opcional)</label>
            <input name="clientEmail" type="email" className="field" defaultValue={email} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Valor cobrado (R$)</label>
            <input name="price" className="field" inputMode="decimal" placeholder="Valor do procedimento" />
          </div>
          <div>
            <label className="label">Já recebeu (R$)</label>
            <input name="paid" className="field" inputMode="decimal" placeholder="0,00" />
          </div>
          <div>
            <label className="label">Forma</label>
            <SelectField name="method" ariaLabel="Forma de pagamento" align="right" panelClassName="w-48" options={[
                { value: "PIX", label: "PIX" },
                { value: "CARD", label: "Cartão" },
                { value: "CASH", label: "Dinheiro" },
                { value: "OTHER", label: "Outro" },
              ]} />
          </div>
        </div>
        <div>
          <label className="label">Anotações internas</label>
          <textarea name="adminNotes" rows={3} className="field resize-none" />
        </div>
        <label className="flex items-center gap-2 text-sm text-plum-700">
          <input type="checkbox" name="notifyClient" defaultChecked={whatsappConfigured()} className="accent-plum-900" /> Enviar confirmação no WhatsApp da cliente
        </label>
        <label className="flex items-center gap-2 text-sm text-plum-700">
          <input type="checkbox" name="force" className="accent-plum-900" /> Encaixar mesmo se houver conflito de horário
        </label>
        <SubmitButton className="btn btn-primary" pendingText="Salvando…">
          Criar agendamento
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
