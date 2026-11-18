import { Send } from "lucide-react";
import { ActionForm } from "@/components/admin/ActionForm";
import { PageHeader } from "@/components/admin/AppointmentItem";
import { WhatsappConnection } from "@/components/admin/WhatsappConnection";
import { WhatsappTemplates } from "@/components/admin/WhatsappTemplates";
import { SubmitButton } from "@/components/ui/client";
import { formatPhone } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { formatStudioDateTime } from "@/lib/time";
import { getWhatsappStatus } from "@/lib/whatsapp";
import { recentWhatsappMessages } from "@/lib/whatsapp-notify";
import { SAMPLE_VARS } from "@/lib/whatsapp-templates";
import { whatsappTestAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "WhatsApp" };

const KIND_LABEL = { confirmacao: "Confirmação", lembrete: "Lembrete", studio: "Aviso ao studio", teste: "Teste" } as const;

export default async function WhatsappPage() {
  const [status, s, messages] = await Promise.all([getWhatsappStatus(), getSettings(), recentWhatsappMessages(25)]);
  const sample = { ...SAMPLE_VARS, studio: s.studioName, endereco: [s.address, s.city].filter(Boolean).join(", ") };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Mensagens" title="WhatsApp" />
      <p className="-mt-4 mb-6 text-sm text-plum-600/70">
        Conecte o WhatsApp do studio para enviar confirmações e lembretes automáticos às clientes.
      </p>

      <WhatsappConnection initial={status} />

      {status.state === "open" && (
        <div className="card mt-4 p-6">
          <p className="font-medium text-plum-900">Enviar mensagem de teste</p>
          <ActionForm action={whatsappTestAction} className="mt-3 flex flex-wrap items-end gap-3">
            <div className="w-full max-w-xs">
              <label className="label" htmlFor="wa-test">WhatsApp</label>
              <input id="wa-test" name="phone" inputMode="tel" placeholder="(92) 99999-9999" className="field" defaultValue={s.whatsapp} />
            </div>
            <SubmitButton className="btn btn-outline" pendingText="Enviando…">
              <Send className="size-4" /> Enviar teste
            </SubmitButton>
          </ActionForm>
        </div>
      )}

      <h2 className="mt-12 font-display text-3xl">Mensagens automáticas</h2>
      <p className="mt-1 mb-5 text-sm text-plum-600/70">Edite os textos à vontade. Clique numa variável para inserir no ponto do cursor.</p>
      <WhatsappTemplates
        confirmEnabled={s.waConfirmEnabled}
        confirmTemplate={s.waConfirmTemplate}
        reminderEnabled={s.waReminderEnabled}
        reminderTemplate={s.waReminderTemplate}
        studioAlerts={s.waStudioAlerts}
        sample={sample}
      />

      <h2 className="mt-12 font-display text-3xl">Últimos envios</h2>
      <div className="card mt-4 overflow-hidden">
        {messages.length === 0 ? (
          <p className="p-8 text-center text-sm text-plum-600/70">Nenhuma mensagem enviada ainda.</p>
        ) : (
          <ul className="divide-y divide-lavender-100">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3.5 text-sm">
                <span className="w-32 shrink-0 text-xs text-plum-600/60">{formatStudioDateTime(m.createdAt)}</span>
                <span className="w-32 shrink-0 font-medium text-plum-900">{KIND_LABEL[m.kind] ?? m.kind}</span>
                <span className="w-36 shrink-0 text-plum-700">{formatPhone(m.toNumber.replace(/^55/, ""))}</span>
                <span className="min-w-0 flex-1 truncate text-plum-600/70" title={m.error || m.preview}>
                  {m.status === "falhou" ? m.error : m.preview.split("\n")[0]}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[0.68rem] tracking-wide ${m.status === "enviada" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                >
                  {m.status === "enviada" ? "Enviada" : "Falhou"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
