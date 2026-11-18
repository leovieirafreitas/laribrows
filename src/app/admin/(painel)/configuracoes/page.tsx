import { CheckCircle2, CircleAlert } from "lucide-react";
import { changePasswordAction, saveSettingsAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/AppointmentItem";
import { PaymentSettingsFields } from "@/components/admin/PaymentSettingsFields";
import { SubmitButton } from "@/components/ui/client";
import { requireAdmin } from "@/lib/auth";
import { getSettings, mercadoPagoConfigured, mercadoPagoIsTest, siteUrl } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const [s, admin] = await Promise.all([getSettings(), requireAdmin()]);
  const mp = mercadoPagoConfigured();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Studio" title="Configurações" />

      {/* Pagamentos */}
      <Section title="Pagamentos" text="Defina se o agendamento pede sinal, valor total ou nenhum pagamento online.">
        <div className={`mb-6 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${mp ? "bg-emerald-50 text-emerald-800" : "bg-lavender-50 text-plum-700"}`}>
          {mp ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-lavender-600" />}
          <div className="leading-relaxed">
            {mp ? (
              <>
                <strong className="font-medium">Mercado Pago conectado</strong> {mercadoPagoIsTest() ? "(credenciais de TESTE)" : "(produção)"}.
                <br />
                URL do webhook para cadastrar no painel do Mercado Pago: <code className="break-all">{siteUrl()}/api/webhooks/mercadopago</code>
              </>
            ) : (
              <>
                <strong className="font-medium">Mercado Pago não conectado.</strong> Adicione <code>MP_ACCESS_TOKEN</code> no arquivo <code>.env.local</code> para
                receber PIX automático e cartão de crédito. Enquanto isso, use a chave PIX própria ou o modo simulação.
              </>
            )}
          </div>
        </div>
        <ActionForm action={saveSettingsAction.bind(null, "payments")}>
          <PaymentSettingsFields s={s} mpConfigured={mp} />
          <SubmitButton className="btn btn-primary btn-sm mt-6">Salvar pagamentos</SubmitButton>
        </ActionForm>
      </Section>

      {/* Studio */}
      <Section title="Dados do studio" text="Aparecem no site, no rodapé e nas mensagens.">
        <ActionForm action={saveSettingsAction.bind(null, "studio")} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do studio" name="studioName" defaultValue={s.studioName} />
          <Field label="Frase de destaque" name="tagline" defaultValue={s.tagline} />
          <div className="sm:col-span-2">
            <label className="label">Sobre o studio</label>
            <textarea name="about" rows={3} defaultValue={s.about} className="field resize-none" placeholder="Um texto curto sobre você e o seu atendimento." />
          </div>
          <Field label="WhatsApp" name="whatsapp" defaultValue={s.whatsapp} placeholder="(11) 98765-4321" />
          <Field label="Instagram" name="instagram" defaultValue={s.instagram} placeholder="@laribrows" />
          <Field label="Endereço" name="address" defaultValue={s.address} placeholder="Rua, número, sala" />
          <Field label="Cidade" name="city" defaultValue={s.city} />
          <div className="sm:col-span-2">
            <SubmitButton className="btn btn-primary btn-sm">Salvar dados</SubmitButton>
          </div>
        </ActionForm>
      </Section>

      {/* Agenda */}
      <Section title="Regras da agenda" text="Como os horários são oferecidos às clientes.">
        <ActionForm action={saveSettingsAction.bind(null, "schedule")} className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Intervalo entre horários (min)" name="slotIntervalMin" defaultValue={s.slotIntervalMin} hint="Ex.: 30 → 9:00, 9:30, 10:00…" />
          <NumberField label="Agenda aberta para os próximos (dias)" name="bookingWindowDays" defaultValue={s.bookingWindowDays} />
          <NumberField label="Antecedência mínima (horas)" name="minAdvanceHours" defaultValue={s.minAdvanceHours} hint="Evita agendamentos em cima da hora." />
          <NumberField label="Tempo para pagar (min)" name="holdMinutes" defaultValue={s.holdMinutes} hint="O horário fica reservado enquanto a cliente paga." />
          <NumberField label="Cliente pode cancelar/remarcar até (horas antes)" name="clientChangeHours" defaultValue={s.clientChangeHours} hint="Vale para a área da cliente. Depois disso, só falando com você." />
          <div className="sm:col-span-2">
            <SubmitButton className="btn btn-primary btn-sm">Salvar regras</SubmitButton>
          </div>
        </ActionForm>
      </Section>

      {/* Acesso */}
      <Section title="Seu acesso" text="E-mail e senha do painel.">
        <ActionForm action={changePasswordAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" name="name" defaultValue={admin.name} />
          <Field label="E-mail" name="email" type="email" defaultValue={admin.email} />
          <Field label="Nova senha (opcional)" name="next" type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
          <Field label="Senha atual (obrigatória)" name="current" type="password" autoComplete="current-password" />
          <div className="sm:col-span-2">
            <SubmitButton className="btn btn-primary btn-sm">Atualizar acesso</SubmitButton>
          </div>
        </ActionForm>
      </Section>
    </div>
  );
}

function Section({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="card p-6 sm:p-8">
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="mt-1 mb-6 text-sm text-plum-600/70">{text}</p>
      {children}
    </section>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={props.name}>
        {label}
      </label>
      <input id={props.name} className="field" {...props} />
    </div>
  );
}

function NumberField({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={props.name}>
        {label}
      </label>
      <input id={props.name} type="number" className="field" {...props} />
      {hint && <p className="mt-1 text-xs text-plum-600/60">{hint}</p>}
    </div>
  );
}
