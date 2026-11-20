"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Clock, CreditCard, Loader2, Mail, QrCode, RotateCw, ShieldCheck, Sparkles } from "lucide-react";
import { confirmBookingCodeAction, createBookingAction, sendBookingCodeAction } from "@/app/(site)/agendar/actions";
import { Turnstile } from "@/components/ui/Turnstile";
import { Calendar, type DayStatus } from "@/components/booking/Calendar";
import { formatBRL, formatDuration, formatPhone, isValidPhone } from "@/lib/format";
import { PhoneHint } from "@/components/ui/PhoneHint";
import { depositCents, promoEndLabel } from "@/lib/pricing";
import type { PublicSettings } from "@/lib/settings";
import { addMonths, formatDateLong, minToTime, STUDIO_TZ_LABEL } from "@/lib/time";

/** priceCents = preço que vale agora; fullPriceCents = preço normal (só com promoção). */
type ServiceOption = { id: string; name: string; description: string; durationMin: number; priceCents: number; fullPriceCents: number | null; promoLabel: string };

const STEPS = ["Procedimento", "Data e horário", "Seus dados", "Confirmação"];

export function BookingFlow({
  services,
  settings: s,
  initialServiceId,
  today,
  simulation,
  prefill,
  turnstileSiteKey,
}: {
  services: ServiceOption[];
  settings: PublicSettings;
  initialServiceId: string | null;
  today: string;
  simulation: boolean;
  prefill: { name: string; phone: string; email: string } | null;
  /** Chave do CAPTCHA (vazia quando a cliente já está logada: não precisa de código). */
  turnstileSiteKey: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialServiceId ? 1 : 0);
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [name, setName] = useState(prefill?.name ?? "");
  const [phone, setPhone] = useState(prefill?.phone ? formatPhone(prefill.phone) : "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [notes, setNotes] = useState("");

  const [payOption, setPayOption] = useState<"DEPOSIT" | "FULL">("DEPOSIT");
  const [method, setMethod] = useState<"PIX" | "CARD" | null>(s.pixEnabled ? "PIX" : s.cardEnabled ? "CARD" : null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Confirmação do e-mail por código antes do pagamento (quem já está logada pula esta parte).
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(prefill?.email ?? null);
  const [codeFor, setCodeFor] = useState<{ draftId: string; email: string } | null>(null);
  const [code, setCode] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [resent, setResent] = useState(false);

  const baseService = services.find((x) => x.id === serviceId) ?? null;
  // A promoção vale pelo dia do atendimento: escolhendo um dia depois do fim dela, o preço é o normal.
  const promoEnd = s.promo?.end ?? "";
  const promoUntil = promoEndLabel(promoEnd);
  const service = useMemo(() => {
    if (!baseService || baseService.fullPriceCents == null || !date || !promoEnd || date <= promoEnd) return baseService;
    return { ...baseService, priceCents: baseService.fullPriceCents, fullPriceCents: null, promoLabel: "" };
  }, [baseService, date, promoEnd]);

  // Dias do mês para o procedimento escolhido (a chave identifica a consulta atual)
  const daysKey = serviceId && step >= 1 ? `${serviceId}|${month}|${refreshKey}` : null;
  const [daysData, setDaysData] = useState<{ key: string; days: Record<string, DayStatus>; lastDate: string | null } | null>(null);
  useEffect(() => {
    if (!daysKey) return;
    const [sid, m] = daysKey.split("|");
    let alive = true;
    fetch(`/api/disponibilidade?servico=${sid}&mes=${m}`)
      .then((r) => r.json())
      .then((data: { days?: { date: string; status: DayStatus }[]; lastDate?: string }) => {
        if (!alive) return;
        setDaysData({
          key: daysKey,
          days: Object.fromEntries((data.days ?? []).map((d) => [d.date, d.status])),
          lastDate: data.lastDate ?? null,
        });
      })
      .catch(() => alive && setDaysData({ key: daysKey, days: {}, lastDate: null }));
    return () => {
      alive = false;
    };
  }, [daysKey]);
  const days = daysData?.days ?? {};
  const loadingDays = daysKey != null && daysData?.key !== daysKey;
  const lastDate = daysData?.lastDate ?? null;

  // Horários do dia escolhido
  const slotsKey = serviceId && date ? `${serviceId}|${date}|${refreshKey}` : null;
  const [slotsData, setSlotsData] = useState<{ key: string; slots: number[] } | null>(null);
  useEffect(() => {
    if (!slotsKey) return;
    const [sid, d] = slotsKey.split("|");
    let alive = true;
    fetch(`/api/disponibilidade?servico=${sid}&data=${d}`)
      .then((r) => r.json())
      .then((data: { slots?: number[] }) => alive && setSlotsData({ key: slotsKey, slots: data.slots ?? [] }))
      .catch(() => alive && setSlotsData({ key: slotsKey, slots: [] }));
    return () => {
      alive = false;
    };
  }, [slotsKey]);
  const slots = slotsData && slotsData.key === slotsKey ? slotsData.slots : null;
  const loadingSlots = slotsKey != null && slots == null;

  const dueNow = useMemo(() => {
    if (!service) return 0;
    if (s.chargeMode === "none") return 0;
    if (s.chargeMode === "full") return service.priceCents;
    if (payOption === "FULL" && s.allowFullPayment) return service.priceCents;
    return depositCents(service.priceCents, s.depositPercent);
  }, [service, s, payOption]);

  const groupedSlots = useMemo(() => {
    const g: { label: string; items: number[] }[] = [
      { label: "Manhã", items: [] },
      { label: "Tarde", items: [] },
      { label: "Noite", items: [] },
    ];
    for (const t of slots ?? []) g[t < 720 ? 0 : t < 1080 ? 1 : 2].items.push(t);
    return g.filter((x) => x.items.length);
  }, [slots]);

  const phoneOk = isValidPhone(phone);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canNext = [!!service, !!date && time != null, name.trim().length >= 3 && phoneOk && emailOk, true][step];

  function pickService(id: string) {
    setServiceId(id);
    setDate(null);
    setTime(null);
  }

  function goToStep(n: number) {
    setCodeFor(null);
    setError(null);
    setStep(n);
  }

  function payload() {
    return {
      serviceId: service!.id,
      date: date!,
      startMin: time!,
      clientName: name,
      clientPhone: phone,
      clientEmail: email,
      notes,
      method: s.chargeMode === "none" ? null : method,
      payOption,
      accepted: accepted as true,
    };
  }

  function handleFailure(message: string) {
    setError(message);
    if (/horário/i.test(message)) {
      setCodeFor(null);
      setTime(null);
      setStep(1);
      setRefreshKey((k) => k + 1); // recarrega dias e horários
    }
  }

  function go(res: { redirectTo: string; external: boolean }) {
    if (res.external) window.location.href = res.redirectTo;
    else router.push(res.redirectTo);
  }

  /** Botão Pagar: com e-mail confirmado, grava e vai para o pagamento; sem, manda o código. */
  function pay() {
    if (!service || !date || time == null) return;
    setError(null);
    if (!verifiedEmail) return sendCode();
    startTransition(async () => {
      const res = await createBookingAction(payload());
      if (res.ok) return go(res);
      if (res.needsCode) setVerifiedEmail(null);
      handleFailure(res.error);
    });
  }

  function sendCode(resend = false) {
    if (turnstileSiteKey && !captcha) {
      setError("Aguarde a verificação de segurança terminar e tente de novo.");
      return;
    }
    const token = captcha ?? "";
    setCaptcha(null); // o token vale uma vez só: o widget recomeça e gera outro
    setCaptchaAttempt((n) => n + 1);
    setError(null);
    startTransition(async () => {
      const res = await sendBookingCodeAction(payload(), token);
      if (!res.ok) return handleFailure(res.error);
      setCodeFor({ draftId: res.draftId, email: res.email });
      setCode("");
      setResent(resend);
    });
  }

  function confirmCode() {
    if (!codeFor) return;
    setError(null);
    startTransition(async () => {
      const res = await confirmBookingCodeAction(codeFor.draftId, code);
      if ("verified" in res && res.verified) setVerifiedEmail(codeFor.email);
      if (res.ok) return go(res);
      if ("expired" in res) setCodeFor(null);
      handleFailure(res.error);
      // E-mail já confirmado, mas a reserva falhou: a próxima tentativa não pede código.
      if ("verified" in res && res.verified) setCodeFor(null);
    });
  }

  const maxMonth = lastDate ? lastDate.slice(0, 7) : addMonths(today.slice(0, 7), 2);

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        {/* Indicador de passos */}
        <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-3">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                disabled={i > step}
                onClick={() => goToStep(i)}
                className={`flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-xs tracking-wide transition ${i === step ? "bg-white text-plum-900 shadow-card" : i < step ? "text-plum-700 hover:bg-white/60" : "text-plum-600/40"}`}
              >
                <span className={`grid size-6 place-items-center rounded-full text-[0.65rem] ${i < step ? "bg-lavender-500 text-white" : i === step ? "bg-plum-900 text-white" : "bg-lavender-100 text-plum-600/50"}`}>
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={i === step ? "" : "hidden sm:inline"}>{label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="hidden h-px w-6 bg-lavender-200 sm:block" />}
            </li>
          ))}
        </ol>

        <div className="card p-5 sm:p-8">
          {/* 1 — Procedimento */}
          {step === 0 && (
            <div className="animate-fade-up">
              <h2 className="font-display text-3xl">Qual procedimento você deseja?</h2>
              {services.length === 0 && <p className="mt-6 text-plum-600/70">Nenhum procedimento disponível no momento.</p>}
              <div className="mt-6 grid gap-3">
                {services.map((svc) => {
                  const active = svc.id === serviceId;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => pickService(svc.id)}
                      className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition sm:p-5 ${active ? "border-lavender-500 bg-lavender-50 ring-4 ring-lavender-200/50" : "border-lavender-200 bg-white hover:border-lavender-300"}`}
                    >
                      <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${active ? "border-plum-900 bg-plum-900 text-white" : "border-lavender-300"}`}>
                        {active && <Check className="size-3" />}
                      </span>
                      <span className="flex-1">
                        {svc.promoLabel && (
                          <span className="mb-1.5 inline-block rounded-full bg-plum-900 px-2.5 py-0.5 text-[0.6rem] tracking-[0.18em] text-champagne-300 uppercase">
                            {svc.promoLabel}
                          </span>
                        )}
                        <span className="block font-display text-xl leading-tight">{svc.name}</span>
                        <span className="mt-1 line-clamp-2 block text-sm text-plum-700/70">{svc.description}</span>
                      </span>
                      <span className="text-right">
                        {svc.fullPriceCents != null && <span className="block text-xs text-plum-600/60 line-through">{formatBRL(svc.fullPriceCents)}</span>}
                        <span className="block font-display text-2xl">{formatBRL(svc.priceCents)}</span>
                        {svc.promoLabel && promoUntil && <span className="block text-[0.7rem] text-plum-600/60">atendimentos até {promoUntil}</span>}
                        <span className="flex items-center justify-end gap-1 text-xs text-plum-600/60">
                          <Clock className="size-3" /> {formatDuration(svc.durationMin)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2 — Data e horário */}
          {step === 1 && (
            <div className="grid animate-fade-up gap-8 md:grid-cols-[1.1fr_1fr]">
              <div>
                <h2 className="mb-5 font-display text-3xl">Escolha o dia</h2>
                <Calendar
                  month={month}
                  days={days}
                  selected={date}
                  loading={loadingDays}
                  canPrev={month > today.slice(0, 7)}
                  canNext={month < maxMonth}
                  onPrev={() => setMonth((m) => addMonths(m, -1))}
                  onNext={() => setMonth((m) => addMonths(m, 1))}
                  onSelect={(d) => {
                    setDate(d);
                    setTime(null);
                  }}
                />
                {baseService?.promoLabel && promoUntil && (
                  <p className="mt-4 rounded-xl border border-champagne-300 bg-champagne-200/50 px-4 py-3 text-xs leading-relaxed text-plum-700">
                    {date && date > promoEnd ? (
                      <>
                        Para esse dia o valor é <strong className="font-medium">{formatBRL(service?.priceCents ?? 0)}</strong>. O preço de {baseService.promoLabel} vale
                        para atendimentos até {promoUntil}.
                      </>
                    ) : (
                      <>
                        Preço de {baseService.promoLabel} ({formatBRL(baseService.priceCents)}) para atendimentos até {promoUntil}. Depois disso, o valor é{" "}
                        {formatBRL(baseService.fullPriceCents ?? baseService.priceCents)}.
                      </>
                    )}
                  </p>
                )}
              </div>
              <div className="md:border-l md:border-lavender-100 md:pl-8">
                <h2 className="font-display text-3xl">Horário</h2>
                <p className="mb-5 text-xs text-plum-600/60">Todos os horários no {STUDIO_TZ_LABEL}.</p>
                {!date && <p className="text-sm text-plum-600/70">Selecione um dia disponível no calendário.</p>}
                {date && (
                  <>
                    <p className="mb-4 text-sm text-plum-700">{formatDateLong(date)}</p>
                    {loadingSlots || !slots ? (
                      <p className="flex items-center gap-2 text-sm text-plum-600/70">
                        <Loader2 className="size-4 animate-spin" /> Buscando horários…
                      </p>
                    ) : slots.length === 0 ? (
                      <p className="text-sm text-plum-600/70">Os horários desse dia acabaram de ser preenchidos. Escolha outro dia 💜</p>
                    ) : (
                      <div className="space-y-5">
                        {groupedSlots.map((g) => (
                          <div key={g.label}>
                            <p className="mb-2 text-[0.65rem] tracking-[0.25em] text-plum-600/60 uppercase">{g.label}</p>
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-3 xl:grid-cols-4">
                              {g.items.map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setTime(t)}
                                  className={`rounded-full border py-2 text-sm transition ${time === t ? "border-plum-900 bg-plum-900 text-white" : "border-lavender-200 bg-white hover:border-lavender-500"}`}
                                >
                                  {minToTime(t)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* 3 — Dados */}
          {step === 2 && (
            <div className="animate-fade-up">
              <h2 className="font-display text-3xl">Seus dados</h2>
              <p className="mt-1 text-sm text-plum-600/70">Usamos para confirmar o horário e enviar lembretes.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="name">Nome completo</label>
                  <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Como podemos te chamar?" />
                </div>
                <div>
                  <label className="label" htmlFor="phone">WhatsApp</label>
                  <input id="phone" className="field" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} inputMode="tel" autoComplete="tel" placeholder="(92) 99999-9999" />
                  <PhoneHint phone={phone} />
                </div>
                <div>
                  <label className="label" htmlFor="email">E-mail</label>
                  <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={!!verifiedEmail} autoComplete="email" placeholder="voce@email.com" />
                  {verifiedEmail ? (
                    <p className="mt-1.5 text-xs text-plum-600/60">{prefill ? "Logada na área da cliente." : "E-mail confirmado."}</p>
                  ) : (
                    <p className="mt-1.5 text-xs text-plum-600/60">Antes do pagamento, enviamos um código para este e-mail para confirmar que é seu.</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="notes">Observações <span className="font-normal text-plum-600/50">(opcional)</span></label>
                  <textarea id="notes" rows={3} className="field resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Primeira vez? Alguma alergia ou referência que queira compartilhar?" />
                </div>
              </div>
            </div>
          )}

          {/* 4 — Pagamento / confirmação */}
          {step === 3 && service && codeFor && (
            <div className="animate-fade-up">
              <h2 className="flex items-center gap-2.5 font-display text-3xl">
                <Mail className="size-6 text-lavender-600" /> Confirme seu e-mail
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-plum-600/80">
                {resent ? "Enviamos um novo código" : "Enviamos um código de 6 dígitos"} para <strong className="font-medium text-plum-900">{codeFor.email}</strong>.
                Digite abaixo para confirmar que o e-mail é seu e seguir para o pagamento.
              </p>
              <label className="label mt-6" htmlFor="code">Código</label>
              <input
                id="code"
                className="field text-center font-display text-3xl tracking-[0.4em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6 && !pending) confirmCode();
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="••••••"
              />
              <p className="mt-3 text-xs leading-relaxed text-plum-600/70">
                Não chegou? Olhe o spam e a aba Promoções. Você também pode tocar no botão do e-mail: ele já leva direto para o pagamento.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => sendCode(true)}>
                  <RotateCw className="size-3.5" /> Reenviar código
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => goToStep(2)}>
                  Trocar e-mail
                </button>
              </div>
            </div>
          )}

          {step === 3 && service && !codeFor && (
            <div className="animate-fade-up">
              <h2 className="font-display text-3xl">{s.chargeMode === "none" ? "Confirme seu horário" : "Garanta seu horário"}</h2>

              {s.chargeMode === "deposit" && (
                <p className="mt-1 text-sm text-plum-600/70">
                  Para reservar, pedimos um sinal de {s.depositPercent}% — o valor é abatido no dia do atendimento.
                </p>
              )}

              {s.chargeMode === "deposit" && s.allowFullPayment && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["DEPOSIT", `Sinal de ${s.depositPercent}%`, depositCents(service.priceCents, s.depositPercent), "Restante no dia"],
                      ["FULL", "Valor total", service.priceCents, "Nada a pagar no dia"],
                    ] as const
                  ).map(([key, label, value, hint]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPayOption(key)}
                      className={`rounded-2xl border p-4 text-left transition ${payOption === key ? "border-lavender-500 bg-lavender-50 ring-4 ring-lavender-200/50" : "border-lavender-200 bg-white hover:border-lavender-300"}`}
                    >
                      <span className="text-xs tracking-wide text-plum-600/70">{label}</span>
                      <span className="mt-1 block font-display text-3xl">{formatBRL(value)}</span>
                      <span className="text-xs text-plum-600/60">{hint}</span>
                    </button>
                  ))}
                </div>
              )}

              {s.chargeMode !== "none" && (
                <>
                  <p className="mt-7 mb-3 text-[0.65rem] tracking-[0.25em] text-plum-600/60 uppercase">Forma de pagamento</p>
                  {!s.pixEnabled && !s.cardEnabled ? (
                    <p className="text-sm text-rose-700">Pagamento online indisponível no momento. Fale com a gente pelo WhatsApp.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {s.pixEnabled && (
                        <MethodOption active={method === "PIX"} onClick={() => setMethod("PIX")} icon={<QrCode className="size-5" />} title="PIX" hint={s.pixHint} />
                      )}
                      {s.cardEnabled && (
                        <MethodOption
                          active={method === "CARD"}
                          onClick={() => setMethod("CARD")}
                          icon={<CreditCard className="size-5" />}
                          title="Cartão de crédito"
                          hint={s.cardHint}
                        />
                      )}
                    </div>
                  )}
                </>
              )}

              <label className="mt-7 flex cursor-pointer items-start gap-3 rounded-2xl bg-lavender-50 p-4 text-sm leading-relaxed text-plum-700">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 size-4 accent-plum-900" />
                <span>
                  <strong className="font-medium text-plum-900">Política de agendamento.</strong> {s.cancellationPolicy}{" "}
                  Seus dados são usados só para o atendimento —{" "}
                  <a href="/privacidade" target="_blank" className="text-lavender-700 underline underline-offset-2">
                    veja a Política de Privacidade
                  </a>
                  .
                </span>
              </label>

              {simulation && (
                <p className="mt-4 rounded-2xl border border-dashed border-champagne-400 px-4 py-3 text-xs text-champagne-600">
                  Modo de demonstração: o pagamento será simulado (nenhuma cobrança real).
                </p>
              )}
            </div>
          )}

          {step === 3 && !verifiedEmail && turnstileSiteKey && (
            <div className="mt-4">
              <Turnstile
                key={captchaAttempt}
                siteKey={turnstileSiteKey}
                onToken={setCaptcha}
                onError={() => setError("Não foi possível carregar a verificação de segurança. Recarregue a página.")}
              />
            </div>
          )}

          {step === 3 && !codeFor && s.chargeMode !== "none" && s.checkoutNote && (
            <p className="mt-6 flex gap-2.5 text-xs leading-relaxed text-plum-600/80">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-lavender-600" />
              {s.checkoutNote}
            </p>
          )}

          {error && <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

          {/* Navegação */}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-lavender-100 pt-6">
            {step > 0 ? (
              <button type="button" className="btn btn-ghost" onClick={() => goToStep(codeFor ? step : step - 1)}>
                <ArrowLeft className="size-4" /> Voltar
              </button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <button type="button" className="btn btn-primary" disabled={!canNext} onClick={() => setStep((x) => x + 1)}>
                Continuar <ArrowRight className="size-4" />
              </button>
            ) : codeFor ? (
              <button type="button" className="btn btn-primary" disabled={pending || code.length < 6} onClick={confirmCode}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {s.chargeMode === "none" ? "Confirmar e agendar" : "Confirmar e pagar"}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending || !accepted || (s.chargeMode !== "none" && !method)}
                onClick={pay}
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {s.chargeMode === "none" ? "Confirmar agendamento" : `Pagar ${formatBRL(dueNow)}`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Resumo */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="card overflow-hidden">
          <div className="bg-plum-900 px-6 py-5 text-white">
            <p className="text-[0.62rem] tracking-[0.3em] text-champagne-300 uppercase">Resumo</p>
            <p className="mt-1 font-display text-2xl">{service?.name ?? "Escolha um procedimento"}</p>
          </div>
          <dl className="space-y-3 px-6 py-5 text-sm">
            <Row label="Duração" value={service ? formatDuration(service.durationMin) : "—"} />
            <Row label="Data" value={date ? <span>{formatDateLong(date)}</span> : "—"} />
            <Row label="Horário" value={time != null ? `${minToTime(time)} (Manaus)` : "—"} />
            <div className="hairline my-2" />
            <Row
              label={service?.promoLabel ? `Valor (${service.promoLabel})` : "Valor do procedimento"}
              value={
                service ? (
                  <span>
                    {service.fullPriceCents != null && <span className="mr-1.5 text-plum-600/50 line-through">{formatBRL(service.fullPriceCents)}</span>}
                    {formatBRL(service.priceCents)}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            {service && s.chargeMode !== "none" && (
              <>
                <Row label={dueNow < service.priceCents ? `Sinal (${s.depositPercent}%)` : "Pagamento online"} value={<strong className="font-medium text-plum-900">{formatBRL(dueNow)}</strong>} />
                {dueNow < service.priceCents && <Row label="Restante no dia" value={formatBRL(service.priceCents - dueNow)} />}
              </>
            )}
          </dl>
          <p className="flex items-center gap-2 border-t border-lavender-100 px-6 py-4 text-xs text-plum-600/70">
            <ShieldCheck className="size-4 text-lavender-500" /> Pagamento seguro · dados protegidos
          </p>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-plum-600/70">{label}</dt>
      <dd className="text-right text-plum-900">{value}</dd>
    </div>
  );
}

function MethodOption({ active, onClick, icon, title, hint }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${active ? "border-lavender-500 bg-lavender-50 ring-4 ring-lavender-200/50" : "border-lavender-200 bg-white hover:border-lavender-300"}`}
    >
      <span className={`grid size-10 place-items-center rounded-full ${active ? "bg-plum-900 text-white" : "bg-lavender-100 text-lavender-700"}`}>{icon}</span>
      <span>
        <span className="block font-medium text-plum-900">{title}</span>
        <span className="text-xs text-plum-600/60">{hint}</span>
      </span>
    </button>
  );
}
