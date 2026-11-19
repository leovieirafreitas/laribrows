import { CheckCircle2, CircleAlert } from "lucide-react";
import { changePasswordAction, saveSettingsAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/AppointmentItem";
import { PaymentSettingsFields } from "@/components/admin/PaymentSettingsFields";
import { SubmitButton } from "@/components/ui/client";
import { SelectField } from "@/components/ui/pickers";
import { minToTime } from "@/lib/time";
import { requireAdmin } from "@/lib/auth";
import { infinitePayHandle, infinitePayHasApiKey } from "@/lib/payments/infinitepay";
import { GATEWAY_LABEL, getSettings, mercadoPagoIsTest, onlineGateway, paymentSimulationAllowed, siteUrl } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const [s, admin] = await Promise.all([getSettings(), requireAdmin()]);
  const gateway = onlineGateway();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Studio" title="Configurações" />

      {/* Pagamentos */}
      <Section title="Pagamentos" text="Defina se o agendamento pede sinal, valor total ou nenhum pagamento online.">
        <div className={`mb-6 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${gateway ? "bg-emerald-50 text-emerald-800" : "bg-lavender-50 text-plum-700"}`}>
          {gateway ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-lavender-600" />}
          <div className="leading-relaxed">
            {gateway === "infinitepay" ? (
              <>
                <strong className="font-medium">InfinitePay conectada</strong> (InfiniteTag <code>${infinitePayHandle()}</code>). PIX e cartão em até 12x pelo checkout
                seguro da InfinitePay; a confirmação é automática.
                {!process.env.INFINITEPAY_API_KEY && (
                  <>
                    <br />
                    <span className="text-emerald-700/80">
                      Opcional: com a chave de API (<code>INFINITEPAY_API_KEY</code>), o link de pagamento expira junto com a reserva.
                    </span>
                  </>
                )}
              </>
            ) : gateway === "mercadopago" ? (
              <>
                <strong className="font-medium">Mercado Pago conectado</strong> {mercadoPagoIsTest() ? "(credenciais de TESTE)" : "(produção)"}.
                <br />
                URL do webhook para cadastrar no painel do Mercado Pago: <code className="break-all">{siteUrl()}/api/webhooks/mercadopago</code>
              </>
            ) : (
              <>
                <strong className="font-medium">InfinitePay não conectada.</strong> Defina <code>INFINITEPAY_HANDLE</code> (sua InfiniteTag) nas variáveis do
                site para receber PIX e cartão online. Enquanto isso, só funciona a chave PIX própria
                {paymentSimulationAllowed() ? " (e o modo simulação, ligado neste computador de testes)" : ""}.
              </>
            )}
          </div>
        </div>
        <ActionForm action={saveSettingsAction.bind(null, "payments")}>
          <PaymentSettingsFields
            s={s}
            gateway={gateway ? GATEWAY_LABEL[gateway] : null}
            simulation={paymentSimulationAllowed()}
            infinitePayKey={infinitePayHasApiKey()}
          />
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
          <div>
            <label className="label">Como montar os horários</label>
            <SelectField
              name="slotIntervalMin"
              ariaLabel="Como montar os horários"
              defaultValue={String(s.slotIntervalMin)}
              panelClassName="w-80"
              options={[
                { value: "0", label: "Pela duração do procedimento", hint: "Design de 40 min → 09:00, 09:40, 10:20… sem buracos" },
                ...[15, 20, 30, 45, 60].map((m) => ({ value: String(m), label: `A cada ${m} minutos`, hint: `Grade fixa: 09:00, ${minToTime(9 * 60 + m)}…` })),
                ...([0, 15, 20, 30, 45, 60].includes(s.slotIntervalMin)
                  ? []
                  : [{ value: String(s.slotIntervalMin), label: `A cada ${s.slotIntervalMin} minutos`, hint: "Grade fixa" }]),
              ]}
            />
            <p className="mt-1 text-xs text-plum-600/60">
              “Pela duração” encosta um atendimento no outro e começa o próximo assim que um termina.
            </p>
          </div>
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
