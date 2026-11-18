import Link from "next/link";
import { AlertTriangle, CalendarCheck2, CalendarDays, CircleCheck, Hourglass, Plus, Wallet } from "lucide-react";
import { confirmPendingPaymentAction } from "@/app/admin/actions";
import { AppointmentItem, PageHeader } from "@/components/admin/AppointmentItem";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { SubmitButton } from "@/components/ui/client";
import { getDashboardData } from "@/lib/admin-data";
import { formatBRL } from "@/lib/format";
import { availableMethods, getSettings } from "@/lib/settings";
import { formatDateCompact, formatDateLong, minToTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ senha?: string }> }) {
  const [d, s, { senha }] = await Promise.all([getDashboardData(), getSettings(), searchParams]);
  const methods = availableMethods(s);
  const paymentWarning = s.chargeMode !== "none" && (methods.simulation || methods.missingSetup);
  const hour = Math.floor(d.nowMinutes / 60);
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={formatDateLong(d.today)} title={<>{greeting} <em className="text-lavender-600">✨</em></>}>
        <Link href="/admin/agendamentos/novo" className="btn btn-primary btn-sm">
          <Plus className="size-4" /> Novo agendamento
        </Link>
      </PageHeader>

      {senha === "redefinida" && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-lavender-200 bg-lavender-50 px-5 py-4 text-sm text-plum-700">
          <CircleCheck className="size-4 shrink-0 text-lavender-600" />
          <p>
            <strong className="font-medium">Senha redefinida.</strong> Da próxima vez, entre com a senha nova.
          </p>
        </div>
      )}

      {paymentWarning && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-champagne-300 bg-champagne-200/50 px-5 py-4 text-sm text-champagne-600">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            {methods.simulation ? (
              <>
                <strong className="font-medium">Pagamentos em modo simulação</strong> (só neste computador de testes).
              </>
            ) : (
              <>
                <strong className="font-medium">Parte dos pagamentos online está indisponível.</strong>
              </>
            )}{" "}
            Conecte a InfinitePay (variável <code>INFINITEPAY_HANDLE</code>) ou use &quot;Chave PIX própria&quot; em{" "}
            <Link href="/admin/configuracoes" className="underline">
              Configurações
            </Link>
            .
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<CalendarCheck2 />} label="Atendimentos hoje" value={String(d.todayList.filter((a) => a.status !== "PENDING_PAYMENT").length)} />
        <Stat icon={<CalendarDays />} label="Próximos 7 dias" value={String(d.weekCount)} />
        <Stat icon={<Wallet />} label="Recebido no mês" value={formatBRL(d.monthRevenue)} />
        <Stat icon={<Hourglass />} label="A receber no studio" value={formatBRL(d.toReceive)} hint="restante dos agendamentos confirmados" />
      </div>

      {/* PIX para conferir */}
      {d.awaiting.length > 0 && (
        <section className="mt-6 rounded-3xl border border-lavender-300 bg-white p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl">
            <span className="size-2 rounded-full bg-lavender-500" /> PIX para conferir
          </h2>
          <p className="mt-1 text-sm text-plum-600/70">Clientes que avisaram que pagaram. Confira no extrato do banco e confirme.</p>
          <ul className="mt-4 divide-y divide-lavender-100">
            {d.awaiting.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/agendamentos/${a.id}`} className="font-medium hover:text-lavender-700">
                    {a.clientName}
                  </Link>
                  <p className="text-sm text-plum-600/70">
                    {a.serviceName} · {formatDateCompact(a.date)} às {minToTime(a.startMin)} · código {a.code}
                  </p>
                </div>
                <span className="font-display text-xl">{formatBRL(a.dueNowCents)}</span>
                <form action={confirmPendingPaymentAction.bind(null, a.id)}>
                  <SubmitButton className="btn btn-primary btn-sm">Confirmar recebimento</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        {/* Hoje */}
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Agenda de hoje</h2>
            <Link href={`/admin/agenda?dia=${d.today}`} className="text-xs tracking-wide text-lavender-700 hover:underline">
              Ver agenda
            </Link>
          </div>
          {d.todayList.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-lavender-50 px-4 py-8 text-center text-sm text-plum-600/70">Nenhum atendimento hoje. Dia de descanso? 🌙</p>
          ) : (
            <div className="mt-3 -mx-3">
              {d.todayList.map((a) => (
                <AppointmentItem key={a.id} a={a} />
              ))}
            </div>
          )}

          <h3 className="mt-8 text-[0.65rem] tracking-[0.25em] text-plum-600/60 uppercase">Próximos</h3>
          {d.next.length === 0 ? (
            <p className="mt-3 text-sm text-plum-600/70">Sem agendamentos futuros ainda.</p>
          ) : (
            <div className="mt-2 -mx-3">
              {d.next.map((a) => (
                <AppointmentItem key={a.id} a={a} showDate />
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="card p-5 sm:p-6">
            <h2 className="font-display text-2xl">Faturamento recebido</h2>
            <p className="mb-6 text-xs text-plum-600/60">Sinais e pagamentos aprovados · últimos 6 meses</p>
            <RevenueChart data={d.revenueSeries} />
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="font-display text-2xl">Este mês</h2>
            {d.topServices.length === 0 ? (
              <p className="mt-3 text-sm text-plum-600/70">Ainda sem atendimentos neste mês.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {d.topServices.map(([name, count]) => (
                  <li key={name}>
                    <div className="flex justify-between text-sm">
                      <span className="text-plum-800">{name}</span>
                      <span className="text-plum-600/70 tabular-nums">{count}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-lavender-100">
                      <div className="h-full rounded-full bg-lavender-500" style={{ width: `${(count / d.topServices[0][1]) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-lavender-100 pt-5 text-sm">
              <div>
                <p className="text-plum-600/60">Comparecimento</p>
                <p className="font-display text-2xl">{d.showRate == null ? "—" : `${d.showRate}%`}</p>
              </div>
              <div>
                <p className="text-plum-600/60">Aguardando pagamento</p>
                <p className="font-display text-2xl">{d.pendingPaymentCount}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-plum-600/70 [&>svg]:size-4 [&>svg]:text-lavender-500">
        {icon}
        <span className="text-xs tracking-wide">{label}</span>
      </div>
      <p className="mt-3 font-display text-4xl text-plum-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-plum-600/50">{hint}</p>}
    </div>
  );
}
