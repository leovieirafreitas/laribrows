import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, ExternalLink, Mail, MessageCircle, Phone } from "lucide-react";
import {
  confirmPendingPaymentAction,
  registerPaymentAction,
  rescheduleAction,
  saveAdminNotesAction,
  setStatusAction,
} from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/AppointmentItem";
import { StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { DateField, SelectField, TimeField } from "@/components/ui/pickers";
import { appointments, db, payments } from "@/lib/db";
import { centsToInput, formatBRL, formatDuration, whatsappLink } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { METHOD_LABEL, PAYMENT_STATUS_LABEL, PROVIDER_LABEL } from "@/lib/status";
import { formatDateLong, formatStudioDateTime, minToTime } from "@/lib/time";
import { whatsappConfigured } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agendamento" };

export default async function AgendamentoAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Tudo em paralelo: uma única ida ao banco.
  const [a, pays, s] = await Promise.all([
    db.query.appointments.findFirst({ where: eq(appointments.id, id) }),
    db.select().from(payments).where(eq(payments.appointmentId, id)).orderBy(desc(payments.createdAt)),
    getSettings(),
  ]);
  if (!a) notFound();
  const remaining = Math.max(0, a.totalCents - a.paidCents);
  const firstName = a.clientName.split(" ")[0];
  const waConfirm = whatsappLink(
    a.clientPhone,
    `Oi, ${firstName}! 💜 Passando para confirmar seu horário de ${a.serviceName} na ${s.studioName}: ${formatDateLong(a.date)}, às ${minToTime(a.startMin)}. Te esperamos!`,
  );
  const active = ["CONFIRMED", "AWAITING_CONFIRMATION", "PENDING_PAYMENT"].includes(a.status);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/agendamentos" className="mb-4 inline-flex items-center gap-1.5 text-xs tracking-wide text-plum-600/70 hover:text-plum-900">
        <ArrowLeft className="size-3.5" /> Agendamentos
      </Link>
      <PageHeader eyebrow={`Código ${a.code}`} title={a.clientName}>
        <StatusBadge status={a.status} />
      </PageHeader>

      {a.adminNotes.includes("⚠️") && (
        <p className="mb-6 rounded-2xl border border-champagne-300 bg-champagne-200/50 px-5 py-3 text-sm text-champagne-600">{a.adminNotes}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* Resumo */}
          <section className="card p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Info label="Procedimento" value={a.serviceName} sub={formatDuration(a.endMin - a.startMin)} />
              <Info label="Data e horário" value={<span>{formatDateLong(a.date)}</span>} sub={`${minToTime(a.startMin)} – ${minToTime(a.endMin)}`} />
              <Info label="Valor total" value={formatBRL(a.totalCents)} />
              <Info label="Pago" value={formatBRL(a.paidCents)} sub={remaining > 0 ? `Falta ${formatBRL(remaining)}` : "Quitado ✓"} />
            </div>
            {a.notes && (
              <div className="mt-5 rounded-2xl bg-lavender-50 px-4 py-3 text-sm text-plum-700">
                <span className="text-[0.65rem] tracking-[0.2em] text-plum-600/60 uppercase">Observação da cliente</span>
                <p className="mt-1">{a.notes}</p>
              </div>
            )}
          </section>

          {/* Ações */}
          <section className="card p-6">
            <h2 className="font-display text-2xl">Ações</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(a.status === "AWAITING_CONFIRMATION" || a.status === "PENDING_PAYMENT") && (
                <form action={confirmPendingPaymentAction.bind(null, a.id)}>
                  <SubmitButton className="btn btn-primary btn-sm" confirm="Confirmar que o pagamento foi recebido?">
                    Confirmar pagamento recebido
                  </SubmitButton>
                </form>
              )}
              {a.status === "CONFIRMED" && (
                <form action={setStatusAction.bind(null, a.id, "COMPLETED")}>
                  <SubmitButton className="btn btn-primary btn-sm">Marcar como concluído</SubmitButton>
                </form>
              )}
              {a.status === "CONFIRMED" && (
                <form action={setStatusAction.bind(null, a.id, "NO_SHOW")}>
                  <SubmitButton className="btn btn-outline btn-sm" confirm="Marcar que a cliente não compareceu?">
                    Não compareceu
                  </SubmitButton>
                </form>
              )}
              {(a.status === "COMPLETED" || a.status === "NO_SHOW" || a.status === "CANCELLED" || a.status === "EXPIRED") && (
                <form action={setStatusAction.bind(null, a.id, "CONFIRMED")}>
                  <SubmitButton className="btn btn-outline btn-sm">Reabrir como confirmado</SubmitButton>
                </form>
              )}
              {active && (
                <form action={setStatusAction.bind(null, a.id, "CANCELLED")}>
                  <SubmitButton className="btn btn-danger btn-sm" confirm="Cancelar este agendamento? O horário será liberado.">
                    Cancelar
                  </SubmitButton>
                </form>
              )}
            </div>

            {remaining > 0 && a.status !== "CANCELLED" && a.status !== "EXPIRED" && (
              <ActionForm action={registerPaymentAction.bind(null, a.id)} className="mt-6 border-t border-lavender-100 pt-5">
                <p className="text-sm font-medium text-plum-800">Registrar pagamento recebido no studio</p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="w-36">
                    <label className="label">Valor (R$)</label>
                    <input name="amount" defaultValue={centsToInput(remaining)} className="field" inputMode="decimal" />
                  </div>
                  <div className="w-44">
                    <label className="label">Forma</label>
                    <SelectField name="method" ariaLabel="Forma de pagamento" panelClassName="w-48" options={[
                { value: "PIX", label: "PIX" },
                { value: "CARD", label: "Cartão" },
                { value: "CASH", label: "Dinheiro" },
                { value: "OTHER", label: "Outro" },
              ]} />
                  </div>
                  <SubmitButton className="btn btn-soft">Registrar</SubmitButton>
                </div>
              </ActionForm>
            )}

            {active && (
              <ActionForm action={rescheduleAction.bind(null, a.id)} className="mt-6 border-t border-lavender-100 pt-5">
                <p className="text-sm font-medium text-plum-800">Remarcar</p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div className="w-52">
                    <label className="label">Data</label>
                    <DateField name="date" defaultValue={a.date} />
                  </div>
                  <div className="w-32">
                    <label className="label">Horário</label>
                    <TimeField name="time" defaultValue={minToTime(a.startMin)} ariaLabel="Novo horário" />
                  </div>
                  <SubmitButton className="btn btn-soft">Remarcar</SubmitButton>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  <label className="flex items-center gap-2 text-xs text-plum-600/80">
                    <input type="checkbox" name="notifyClient" defaultChecked={whatsappConfigured()} className="accent-plum-900" /> Avisar a cliente no WhatsApp
                  </label>
                  <label className="flex items-center gap-2 text-xs text-plum-600/80">
                    <input type="checkbox" name="force" className="accent-plum-900" /> Encaixar mesmo se houver conflito
                  </label>
                </div>
              </ActionForm>
            )}
          </section>

          {/* Pagamentos */}
          <section className="card p-6">
            <h2 className="font-display text-2xl">Pagamentos</h2>
            {pays.length === 0 ? (
              <p className="mt-3 text-sm text-plum-600/70">Nenhum pagamento registrado.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[0.65rem] tracking-[0.15em] text-plum-600/60 uppercase">
                      <th className="pb-2 font-normal">Data</th>
                      <th className="pb-2 font-normal">Forma</th>
                      <th className="pb-2 font-normal">Via</th>
                      <th className="pb-2 font-normal">Status</th>
                      <th className="pb-2 text-right font-normal">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-lavender-100">
                    {pays.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 text-plum-700">{formatStudioDateTime(p.paidAt ?? p.createdAt)}</td>
                        <td className="py-2.5">{METHOD_LABEL[p.method]}</td>
                        <td className="py-2.5 text-plum-600/70">{PROVIDER_LABEL[p.provider] ?? p.provider}</td>
                        <td className="py-2.5">
                          <span className={p.status === "APPROVED" ? "text-emerald-700" : p.status === "PENDING" ? "text-champagne-600" : "text-plum-600/50"}>
                            {PAYMENT_STATUS_LABEL[p.status]}
                          </span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{formatBRL(p.amountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* Cliente */}
          <section className="card p-6">
            <h2 className="font-display text-2xl">Cliente</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <Phone className="size-4 text-lavender-500" /> {a.clientPhone}
              </li>
              {a.clientEmail && (
                <li className="flex items-center gap-3 break-all">
                  <Mail className="size-4 shrink-0 text-lavender-500" /> {a.clientEmail}
                </li>
              )}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              {waConfirm && (
                <a href={waConfirm} target="_blank" rel="noreferrer" className="btn btn-soft btn-sm">
                  <MessageCircle className="size-4" /> Enviar confirmação
                </a>
              )}
              <Link href={`/agendamento/${a.id}`} target="_blank" className="btn btn-ghost btn-sm">
                <ExternalLink className="size-4" /> Página da cliente
              </Link>
            </div>
          </section>

          {/* Anotações */}
          <section className="card p-6">
            <h2 className="font-display text-2xl">Anotações internas</h2>
            <ActionForm action={saveAdminNotesAction.bind(null, a.id)} className="mt-4">
              <textarea name="adminNotes" defaultValue={a.adminNotes} rows={5} className="field resize-none text-sm" placeholder="Ficha da cliente, cor da henna, formato preferido…" />
              <SubmitButton className="btn btn-soft btn-sm mt-3">Salvar anotação</SubmitButton>
            </ActionForm>
          </section>

          <p className="px-2 text-xs text-plum-600/50">
            Criado em {formatStudioDateTime(a.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <p className="text-[0.65rem] tracking-[0.2em] text-plum-600/60 uppercase">{label}</p>
      <p className="mt-1 font-display text-xl text-plum-900">{value}</p>
      {sub && <p className="text-xs text-plum-600/70">{sub}</p>}
    </div>
  );
}
