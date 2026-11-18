"use client";

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { saveWhatsappSettingsAction } from "@/app/admin/(painel)/whatsapp/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/ui/client";
import { DEFAULT_CONFIRM_TEMPLATE, DEFAULT_REMINDER_TEMPLATE, renderTemplate, TEMPLATE_VARS, type Vars } from "@/lib/whatsapp-templates";

type Props = {
  confirmEnabled: boolean;
  confirmTemplate: string;
  reminderEnabled: boolean;
  reminderTemplate: string;
  studioAlerts: boolean;
  sample: Vars;
};

/** Liga/desliga e edita as mensagens automáticas, com prévia no estilo do WhatsApp. */
export function WhatsappTemplates(p: Props) {
  return (
    <ActionForm action={saveWhatsappSettingsAction} className="space-y-6">
      <TemplateEditor
        title="Confirmação para a cliente"
        text="Enviada quando o horário é confirmado: pagamento aprovado, PIX conferido por você ou agendamento lançado no painel (se você marcar para avisar). Também vai quando o horário é remarcado."
        toggleName="waConfirmEnabled"
        enabled={p.confirmEnabled}
        name="waConfirmTemplate"
        initial={p.confirmTemplate || DEFAULT_CONFIRM_TEMPLATE}
        fallback={DEFAULT_CONFIRM_TEMPLATE}
        sample={p.sample}
      />
      <TemplateEditor
        title="Lembrete um dia antes"
        text="Enviado cerca de 24h antes do horário, para quem agendou com antecedência."
        toggleName="waReminderEnabled"
        enabled={p.reminderEnabled}
        name="waReminderTemplate"
        initial={p.reminderTemplate || DEFAULT_REMINDER_TEMPLATE}
        fallback={DEFAULT_REMINDER_TEMPLATE}
        sample={p.sample}
      />
      <div className="card p-6">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" name="waStudioAlerts" defaultChecked={p.studioAlerts} className="mt-1 size-4 accent-plum-900" />
          <span>
            <span className="block font-medium text-plum-900">Avisos para o studio</span>
            <span className="mt-1 block text-sm leading-relaxed text-plum-600/70">
              Você recebe no WhatsApp: novo agendamento pelo site, cancelamento e remarcação feitos pela cliente. Vão para o WhatsApp do studio em
              Configurações → Dados do studio (ou, se estiver vazio, para o próprio número conectado).
            </span>
          </span>
        </label>
      </div>
      <SubmitButton className="btn btn-primary">Salvar mensagens</SubmitButton>
    </ActionForm>
  );
}

function TemplateEditor(props: {
  title: string;
  text: string;
  toggleName: string;
  enabled: boolean;
  name: string;
  initial: string;
  fallback: string;
  sample: Vars;
}) {
  const [value, setValue] = useState(props.initial);
  const [on, setOn] = useState(props.enabled);
  const ref = useRef<HTMLTextAreaElement>(null);

  function insert(variable: string) {
    const el = ref.current;
    if (!el) return setValue((v) => v + variable);
    const { selectionStart: a, selectionEnd: b } = el;
    const next = value.slice(0, a) + variable + value.slice(b);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + variable.length, a + variable.length);
    });
  }

  return (
    <div className="card p-6">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name={props.toggleName} checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-1 size-4 accent-plum-900" />
        <span>
          <span className="block font-medium text-plum-900">{props.title}</span>
          <span className="mt-1 block text-sm leading-relaxed text-plum-600/70">{props.text}</span>
        </span>
      </label>

      <div className={`mt-5 grid gap-5 lg:grid-cols-[1fr_18rem] ${on ? "" : "opacity-50"}`}>
        <div>
          <textarea ref={ref} name={props.name} value={value} onChange={(e) => setValue(e.target.value)} rows={12} className="field resize-y font-mono text-[0.8rem] leading-relaxed" />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {TEMPLATE_VARS.map(([v, hint]) => (
              <button
                key={v}
                type="button"
                title={hint}
                onClick={() => insert(v)}
                className="rounded-full bg-lavender-100 px-2.5 py-1 font-mono text-[0.68rem] text-lavender-700 transition hover:bg-lavender-200"
              >
                {v}
              </button>
            ))}
            <button type="button" onClick={() => setValue(props.fallback)} className="ml-auto flex items-center gap-1 text-xs text-plum-600/70 hover:text-plum-900">
              <RotateCcw className="size-3.5" /> Modelo padrão
            </button>
          </div>
        </div>
        <div>
          <p className="mb-2 text-[0.65rem] tracking-[0.25em] text-plum-600/60 uppercase">Como a cliente recebe</p>
          <div className="rounded-3xl bg-[#e9e3da] p-3">
            <div className="ml-auto max-w-full rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[0.8rem] leading-snug whitespace-pre-wrap text-[#111b21] shadow-sm">
              {renderTemplate(value, props.sample) || "—"}
            </div>
          </div>
          <p className="mt-2 text-[0.7rem] leading-relaxed text-plum-600/60">Linhas com informação vazia (ex.: sem endereço cadastrado) não aparecem.</p>
        </div>
      </div>
    </div>
  );
}
