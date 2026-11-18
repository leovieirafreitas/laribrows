"use client";

import { useState } from "react";
import type { Settings } from "@/lib/db/schema";

/** Campos de cobrança com exibição condicional (sinal %, PIX manual...). */
export function PaymentSettingsFields({ s, mpConfigured }: { s: Settings; mpConfigured: boolean }) {
  const [mode, setMode] = useState(s.chargeMode);
  const [pct, setPct] = useState(s.depositPercent);
  const [pixEnabled, setPixEnabled] = useState(s.pixEnabled);
  const [cardEnabled, setCardEnabled] = useState(s.cardEnabled);
  const [pixProvider, setPixProvider] = useState(s.pixProvider);

  const modes = [
    { key: "deposit", title: "Sinal de entrada", text: "Cobra uma porcentagem para garantir o horário." },
    { key: "full", title: "Valor total", text: "A cliente paga o procedimento inteiro online." },
    { key: "none", title: "Sem pagamento online", text: "Só reserva; o pagamento é feito no studio." },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <p className="label">Cobrança no agendamento</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {modes.map((m) => (
            <label
              key={m.key}
              className={`cursor-pointer rounded-2xl border p-4 transition ${mode === m.key ? "border-plum-900 bg-lavender-50 ring-4 ring-lavender-200/50" : "border-lavender-200 bg-white hover:border-lavender-300"}`}
            >
              <input type="radio" name="chargeMode" value={m.key} checked={mode === m.key} onChange={() => setMode(m.key)} className="sr-only" />
              <span className="block font-medium text-plum-900">{m.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-plum-600/70">{m.text}</span>
            </label>
          ))}
        </div>
      </div>

      {mode === "deposit" && (
        <div className="grid gap-4 rounded-2xl bg-lavender-50 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div>
            <label className="label">Porcentagem do sinal</label>
            <div className="flex items-center gap-2">
              <input type="number" name="depositPercent" min={1} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="field w-24" />
              <span className="text-plum-700">%</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[30, 50, 100].map((v) => (
              <button key={v} type="button" onClick={() => setPct(v)} className={`btn btn-sm ${pct === v ? "btn-primary" : "btn-outline"}`}>
                {v}%
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-plum-700 sm:col-span-2">
            <input type="checkbox" name="allowFullPayment" defaultChecked={s.allowFullPayment} className="size-4 accent-plum-900" />
            Deixar a cliente escolher pagar o valor total
          </label>
        </div>
      )}
      {mode !== "deposit" && <input type="hidden" name="depositPercent" value={pct} />}
      {mode !== "deposit" && s.allowFullPayment && <input type="hidden" name="allowFullPayment" value="on" />}

      {mode !== "none" && (
        <>
          <div className="space-y-3">
            <p className="label">Formas de pagamento</p>
            <div className="rounded-2xl border border-lavender-200 bg-white p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" name="pixEnabled" checked={pixEnabled} onChange={(e) => setPixEnabled(e.target.checked)} className="size-4 accent-plum-900" />
                <span className="font-medium text-plum-900">PIX</span>
              </label>
              <span className="block pl-7">
                {pixEnabled && (
                  <span className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className={`cursor-pointer rounded-xl border p-3 text-sm ${pixProvider === "mercadopago" ? "border-plum-900 bg-lavender-50" : "border-lavender-200"}`}>
                      <input type="radio" name="pixProvider" value="mercadopago" checked={pixProvider === "mercadopago"} onChange={() => setPixProvider("mercadopago")} className="mr-2 accent-plum-900" />
                      Automático (Mercado Pago)
                      <span className="mt-1 block text-xs text-plum-600/70">Confirma sozinho quando a cliente paga.</span>
                    </label>
                    <label className={`cursor-pointer rounded-xl border p-3 text-sm ${pixProvider === "manual" ? "border-plum-900 bg-lavender-50" : "border-lavender-200"}`}>
                      <input type="radio" name="pixProvider" value="manual" checked={pixProvider === "manual"} onChange={() => setPixProvider("manual")} className="mr-2 accent-plum-900" />
                      Chave PIX própria
                      <span className="mt-1 block text-xs text-plum-600/70">Sem taxas. Você confere e confirma no painel.</span>
                    </label>
                  </span>
                )}
              </span>
            </div>

            {pixEnabled && pixProvider === "manual" && (
              <div className="grid gap-3 rounded-2xl bg-lavender-50 p-4 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <label className="label">Chave PIX</label>
                  <input name="pixKey" defaultValue={s.pixKey} className="field" placeholder="E-mail, CPF/CNPJ, +5511999999999 ou chave aleatória" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Nome do recebedor</label>
                  <input name="pixReceiverName" defaultValue={s.pixReceiverName} className="field" placeholder="Como aparece no banco" />
                </div>
                <div>
                  <label className="label">Cidade</label>
                  <input name="pixReceiverCity" defaultValue={s.pixReceiverCity} className="field" />
                </div>
              </div>
            )}
            {!(pixEnabled && pixProvider === "manual") && (
              <>
                <input type="hidden" name="pixKey" value={s.pixKey} />
                <input type="hidden" name="pixReceiverName" value={s.pixReceiverName} />
                <input type="hidden" name="pixReceiverCity" value={s.pixReceiverCity} />
              </>
            )}
            {!pixEnabled && <input type="hidden" name="pixProvider" value={pixProvider} />}

            <div className="rounded-2xl border border-lavender-200 bg-white p-4">
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" name="cardEnabled" checked={cardEnabled} onChange={(e) => setCardEnabled(e.target.checked)} className="size-4 accent-plum-900" />
                <span className="font-medium text-plum-900">Cartão de crédito</span>
              </label>
              <span className="block pl-7">
                <span className="block text-xs text-plum-600/70">Via Mercado Pago (checkout seguro).</span>
                {cardEnabled && (
                  <span className="mt-3 flex items-center gap-2 text-sm">
                    Parcelar em até
                    <select name="maxInstallments" defaultValue={s.maxInstallments} className="field w-20 px-3 py-1.5">
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}x
                        </option>
                      ))}
                    </select>
                  </span>
                )}
              </span>
            </div>
            {!cardEnabled && <input type="hidden" name="maxInstallments" value={s.maxInstallments} />}
          </div>

          {!mpConfigured && (cardEnabled || (pixEnabled && pixProvider === "mercadopago")) && (
            <p className="rounded-2xl border border-dashed border-champagne-400 px-4 py-3 text-xs leading-relaxed text-champagne-600">
              O Mercado Pago ainda não está conectado, então cartão{pixProvider === "mercadopago" ? " e PIX automático" : ""} funcionam em modo simulação.
            </p>
          )}
        </>
      )}
      {mode === "none" && (
        <>
          {pixEnabled && <input type="hidden" name="pixEnabled" value="on" />}
          {cardEnabled && <input type="hidden" name="cardEnabled" value="on" />}
          <input type="hidden" name="pixProvider" value={pixProvider} />
          <input type="hidden" name="pixKey" value={s.pixKey} />
          <input type="hidden" name="pixReceiverName" value={s.pixReceiverName} />
          <input type="hidden" name="pixReceiverCity" value={s.pixReceiverCity} />
          <input type="hidden" name="maxInstallments" value={s.maxInstallments} />
        </>
      )}

      <div>
        <label className="label">Política de agendamento (mostrada antes do pagamento)</label>
        <textarea name="cancellationPolicy" rows={3} defaultValue={s.cancellationPolicy} className="field resize-none text-sm" />
      </div>
    </div>
  );
}
