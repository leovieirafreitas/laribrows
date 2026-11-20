import { asc } from "drizzle-orm";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { deleteServiceAction, savePromoAction, saveServiceAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/AppointmentItem";
import { SubmitButton } from "@/components/ui/client";
import { DateField } from "@/components/ui/pickers";
import { db, services, type Service } from "@/lib/db";
import { centsToInput, formatBRL, formatDuration } from "@/lib/format";
import { depositCents, promoActive, servicePrice } from "@/lib/pricing";
import { getSettings, promoOf } from "@/lib/settings";
import { formatDateShort, todayInStudio } from "@/lib/time";
import type { Settings } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Procedimentos" };

export default async function ProcedimentosPage() {
  await requireAdmin();
  const [list, s] = await Promise.all([db.select().from(services).orderBy(asc(services.sortOrder), asc(services.name)), getSettings()]);
  const today = todayInStudio();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Catálogo" title="Procedimentos e valores" />
      <p className="-mt-4 mb-8 text-sm text-plum-600/70">
        O que aparece no site e no agendamento.{" "}
        {s.chargeMode === "deposit" && `O sinal cobrado é de ${s.depositPercent}% do valor (altere em Configurações).`}
      </p>

      <PromoSection s={s} withPromo={list.filter((x) => x.active && x.promoPriceCents != null).length} />

      <div className="space-y-3">
        {list.map((svc) => (
          <details key={svc.id} className="card group overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center gap-4 p-5 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1">
                <p className={`font-display text-2xl leading-tight ${svc.active ? "" : "text-plum-600/40 line-through"}`}>{svc.name}</p>
                <p className="mt-0.5 text-sm text-plum-600/70">
                  {formatDuration(svc.durationMin)}
                  {!svc.active && " · inativo (não aparece no site)"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl">{formatBRL(svc.priceCents)}</p>
                {svc.promoPriceCents != null && (
                  <p className="flex items-center justify-end gap-1 text-xs font-medium text-lavender-700">
                    <Tag className="size-3" /> {s.promoLabel || "Promoção"}: {formatBRL(svc.promoPriceCents)}
                  </p>
                )}
                {s.chargeMode === "deposit" && (
                  <p className="text-xs text-plum-600/60">sinal {formatBRL(depositCents(servicePrice(svc, promoOf(s), today).priceCents, s.depositPercent))}</p>
                )}
              </div>
              <span className="grid size-9 place-items-center rounded-full bg-lavender-100 text-lavender-700 transition group-open:bg-plum-900 group-open:text-white">
                <Pencil className="size-4" />
              </span>
            </summary>
            <div className="border-t border-lavender-100 bg-lavender-50/40 p-5">
              <ServiceForm svc={svc} />
              <form action={deleteServiceAction.bind(null, svc.id)} className="mt-4 border-t border-lavender-100 pt-4">
                <SubmitButton className="btn btn-danger btn-sm" confirm="Excluir este procedimento? Se já tiver agendamentos, ele será apenas desativado.">
                  <Trash2 className="size-3.5" /> Excluir
                </SubmitButton>
              </form>
            </div>
          </details>
        ))}
      </div>

      <section className="card mt-8 p-6">
        <h2 className="flex items-center gap-2 font-display text-2xl">
          <Plus className="size-5 text-lavender-600" /> Novo procedimento
        </h2>
        <div className="mt-4">
          <ServiceForm />
        </div>
      </section>
    </div>
  );
}

function ServiceForm({ svc }: { svc?: Service }) {
  return (
    <ActionForm action={saveServiceAction.bind(null, svc?.id ?? null)} resetOnSuccess={!svc} className="grid gap-4 sm:grid-cols-6">
      <div className="sm:col-span-4">
        <label className="label">Nome</label>
        <input name="name" required defaultValue={svc?.name} className="field" placeholder="Ex.: Design com Henna" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Valor (R$)</label>
        <input name="price" required defaultValue={svc ? centsToInput(svc.priceCents) : ""} className="field" inputMode="decimal" placeholder="85,00" />
      </div>
      <div className="sm:col-span-6 rounded-2xl border border-dashed border-lavender-300 bg-white/60 p-4">
        <div className="grid items-end gap-3 sm:grid-cols-[12rem_1fr]">
          <div>
            <label className="label">Preço promocional (R$)</label>
            <input
              name="promoPrice"
              defaultValue={svc?.promoPriceCents != null ? centsToInput(svc.promoPriceCents) : ""}
              className="field"
              inputMode="decimal"
              placeholder="Ex.: 30,00"
            />
          </div>
          <p className="pb-2 text-xs leading-relaxed text-plum-600/70">
            Opcional. Vale só enquanto a promoção (no topo da página) estiver ativa. Deixe vazio para este procedimento não entrar na promoção.
          </p>
        </div>
      </div>
      <div className="sm:col-span-6">
        <label className="label">Descrição</label>
        <textarea name="description" rows={2} defaultValue={svc?.description} className="field resize-none" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Duração (min)</label>
        <input name="durationMin" type="number" min={5} max={600} step={5} required defaultValue={svc?.durationMin ?? 60} className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Ordem no site</label>
        <input name="sortOrder" type="number" defaultValue={svc?.sortOrder ?? 0} className="field" />
      </div>
      <label className="flex items-center gap-2 self-end pb-3 text-sm text-plum-700 sm:col-span-2">
        <input type="checkbox" name="active" defaultChecked={svc?.active ?? true} className="size-4 accent-plum-900" /> Ativo no site
      </label>
      <div className="sm:col-span-6">
        <SubmitButton className="btn btn-primary btn-sm">{svc ? "Salvar alterações" : "Adicionar procedimento"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

function PromoSection({ s, withPromo }: { s: Settings; withPromo: number }) {
  const today = todayInStudio();
  const active = promoActive(promoOf(s), today);
  const status = !s.promoEnabled
    ? "Desligada"
    : active
      ? `Valendo agora${s.promoEnd ? ` · termina em ${formatDateShort(s.promoEnd)}` : ""}`
      : s.promoStart && today < s.promoStart
        ? `Agendada · começa em ${formatDateShort(s.promoStart)}`
        : `Encerrada em ${formatDateShort(s.promoEnd)}`;

  return (
    <section className={`card mb-8 p-6 ${active ? "border-lavender-400 ring-4 ring-lavender-200/40" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-2xl">
          <Tag className="size-5 text-lavender-600" /> Promoção
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-[0.68rem] tracking-wide ${active ? "bg-emerald-50 text-emerald-700" : "bg-lavender-100 text-plum-700"}`}
        >
          {status}
        </span>
      </div>
      <p className="mt-1 text-sm text-plum-600/70">
        Com a promoção valendo, o site mostra o preço normal riscado e cobra o preço promocional de cada procedimento (inclusive no sinal). Vale para
        atendimentos com data dentro do período: quem agenda agora para depois do fim paga o preço normal. {withPromo === 0 && "Nenhum procedimento tem preço promocional ainda: preencha em cada um, abaixo."}
        {withPromo > 0 && `${withPromo} procedimento(s) com preço promocional.`}
      </p>
      <ActionForm action={savePromoAction} className="mt-5 grid gap-4 sm:grid-cols-[1fr_14rem_14rem]">
        <div>
          <label className="label">Nome da promoção</label>
          <input name="promoLabel" defaultValue={s.promoLabel} maxLength={40} className="field" placeholder="Black Friday" />
        </div>
        <div>
          <label className="label">De</label>
          <DateField name="promoStart" defaultValue={s.promoStart || undefined} placeholder="Desde já" />
        </div>
        <div>
          <label className="label">Até</label>
          <DateField name="promoEnd" defaultValue={s.promoEnd || undefined} placeholder="Sem data final" align="right" />
        </div>
        <label className="flex items-center gap-2 text-sm text-plum-700 sm:col-span-3">
          <input type="checkbox" name="promoEnabled" defaultChecked={s.promoEnabled} className="size-4 accent-plum-900" /> Promoção ativa
        </label>
        <div className="sm:col-span-3">
          <SubmitButton className="btn btn-primary btn-sm">Salvar promoção</SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}
