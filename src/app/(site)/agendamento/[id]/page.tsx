import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { CalendarPlus, CheckCircle2, Clock, CreditCard, Hourglass, MapPin, MessageCircle, QrCode, XCircle } from "lucide-react";
import { markPixSentAction, switchMethodAction } from "./actions";
import { Ornament } from "@/components/brand/Ornament";
import { Countdown, PaymentPoller } from "@/components/booking/PaymentWatch";
import { StatusBadge } from "@/components/ui";
import { CopyButton, SubmitButton } from "@/components/ui/client";
import { isHoldExpired, refreshPendingPayment, syncMercadoPagoPayment } from "@/lib/booking";
import { appointments, db, payments, type Appointment } from "@/lib/db";
import { formatBRL, whatsappLink } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { formatDateLong, minToTime, studioToDate } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Seu agendamento", robots: { index: false } };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment_id?: string; collection_id?: string; status?: string }>;
};

export default async function AgendamentoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;

  // Retorno do Checkout Pro do Mercado Pago: confere direto na API.
  const mpPaymentId = sp.payment_id || sp.collection_id;
  if (mpPaymentId && mpPaymentId !== "null") {
    await syncMercadoPagoPayment(mpPaymentId).catch((e) => console.error(e));
  }

  let appt = await db.query.appointments.findFirst({ where: eq(appointments.id, id) });
  if (!appt) notFound();

  let payment = await db.query.payments.findFirst({ where: eq(payments.appointmentId, id), orderBy: desc(payments.createdAt) });
  if (payment?.status === "PENDING") {
    await refreshPendingPayment(payment);
    appt = (await db.query.appointments.findFirst({ where: eq(appointments.id, id) }))!;
    payment = await db.query.payments.findFirst({ where: eq(payments.appointmentId, id), orderBy: desc(payments.createdAt) });
  }

  // Reserva vencida sem pagamento
  if (isHoldExpired(appt)) {
    await db.update(appointments).set({ status: "EXPIRED" }).where(eq(appointments.id, id));
    appt = { ...appt, status: "EXPIRED" };
  }

  const s = await getSettings();
  const wa = whatsappLink(s.whatsapp, `Olá! Sobre meu agendamento ${appt.code} (${appt.serviceName}, ${formatDateLong(appt.date)} às ${minToTime(appt.startMin)}).`);
  const remaining = appt.totalCents - appt.paidCents;
  const qr = payment?.pixCode
    ? await QRCode.toDataURL(payment.pixCode, { margin: 1, width: 320, color: { dark: "#2a2039", light: "#ffffff" } })
    : null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <PaymentPoller appointmentId={appt.id} current={appt.status} />

      <div className="text-center">
        <p className="eyebrow">Agendamento {appt.code}</p>
        <Hero status={appt.status} name={appt.clientName} />
        <div className="mt-5 flex justify-center">
          <StatusBadge status={appt.status} />
        </div>
      </div>

      {/* PIX aguardando pagamento */}
      {appt.status === "PENDING_PAYMENT" && payment?.method === "PIX" && payment.status === "PENDING" && payment.pixCode && (
        <section className="card mt-10 p-6 text-center sm:p-10">
          <p className="flex items-center justify-center gap-2 text-sm text-plum-700">
            <QrCode className="size-4 text-lavender-600" /> Pague com PIX para confirmar
          </p>
          <p className="mt-2 font-display text-5xl">{formatBRL(payment.amountCents)}</p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR Code PIX" className="mx-auto mt-6 size-64 rounded-3xl border border-lavender-200 bg-white p-3 shadow-card" />
          )}
          <p className="mt-6 text-xs text-plum-600/70">Ou copie o código PIX copia e cola:</p>
          <div className="mx-auto mt-2 max-w-md rounded-2xl bg-lavender-50 px-4 py-3 font-mono text-[0.68rem] break-all text-plum-700">{payment.pixCode}</div>
          <div className="mt-5 flex flex-col items-center gap-3">
            <CopyButton text={payment.pixCode} label="Copiar código PIX" />
            {appt.expiresAt && (
              <p className="flex items-center gap-1.5 text-sm text-plum-600/80">
                <Hourglass className="size-4" /> Horário reservado por <Countdown until={appt.expiresAt.getTime()} />
              </p>
            )}
          </div>

          {payment.provider === "pix_manual" ? (
            <div className="mt-8 border-t border-lavender-100 pt-6">
              <p className="text-sm text-plum-700">Depois de pagar, avise a gente para conferirmos:</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <form action={markPixSentAction.bind(null, appt.id)}>
                  <SubmitButton className="btn btn-primary">Já fiz o PIX</SubmitButton>
                </form>
                {wa && (
                  <a href={whatsappLink(s.whatsapp, `Olá! Segue o comprovante do PIX do agendamento ${appt.code} 💜`)} target="_blank" rel="noreferrer" className="btn btn-outline">
                    <MessageCircle className="size-4" /> Enviar comprovante
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-8 flex items-center justify-center gap-2 border-t border-lavender-100 pt-6 text-sm text-plum-600/80">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-lavender-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-lavender-500" />
              </span>
              Aguardando pagamento — esta página atualiza sozinha.
            </p>
          )}
          {payment.provider === "simulated" && <SimulateBox paymentId={payment.id} />}
          {s.cardEnabled && <SwitchMethod appointmentId={appt.id} method="CARD" />}
        </section>
      )}

      {/* Cartão aguardando */}
      {appt.status === "PENDING_PAYMENT" && payment?.method === "CARD" && (
        <section className="card mt-10 p-6 text-center sm:p-10">
          <CreditCard className="mx-auto size-8 text-lavender-600" />
          <p className="mt-3 font-display text-3xl">Finalize o pagamento no cartão</p>
          <p className="mt-2 text-sm text-plum-700/80">
            {payment.status === "REJECTED" || sp.status === "rejected" || sp.status === "failure"
              ? "O pagamento não foi aprovado. Você pode tentar novamente ou pagar com PIX."
              : "Seu horário está reservado. Conclua o pagamento para confirmar."}
          </p>
          <p className="mt-4 font-display text-4xl">{formatBRL(payment.amountCents)}</p>
          <div className="mt-6 flex flex-col items-center gap-3">
            {payment.checkoutUrl && (
              <a href={payment.checkoutUrl} className="btn btn-primary">
                <CreditCard className="size-4" /> Pagar com cartão
              </a>
            )}
            {appt.expiresAt && (
              <p className="flex items-center gap-1.5 text-sm text-plum-600/80">
                <Hourglass className="size-4" /> Reservado por <Countdown until={appt.expiresAt.getTime()} />
              </p>
            )}
          </div>
          {s.pixEnabled && <SwitchMethod appointmentId={appt.id} method="PIX" />}
        </section>
      )}

      {/* Detalhes */}
      <section className="card mt-8 overflow-hidden">
        <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
          <Detail label="Procedimento" value={appt.serviceName} />
          <Detail label="Quando" value={<span>{formatDateLong(appt.date)}, às {minToTime(appt.startMin)}</span>} />
          <Detail label="Valor do procedimento" value={formatBRL(appt.totalCents)} />
          <Detail
            label={appt.paidCents > 0 ? "Pago" : appt.dueNowCents > 0 ? "A pagar agora" : "Pagamento"}
            value={
              appt.paidCents > 0
                ? `${formatBRL(appt.paidCents)}${remaining > 0 ? ` · restante ${formatBRL(remaining)} no dia` : " · quitado"}`
                : appt.dueNowCents > 0
                  ? formatBRL(appt.dueNowCents)
                  : "No dia do atendimento"
            }
          />
        </div>
        {(appt.status === "CONFIRMED" || appt.status === "AWAITING_CONFIRMATION") && (
          <div className="flex flex-wrap gap-3 border-t border-lavender-100 bg-lavender-50/60 px-6 py-5 sm:px-8">
            <a href={googleCalendarUrl(appt, s.studioName, s.address)} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
              <CalendarPlus className="size-4" /> Adicionar à agenda
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                <MessageCircle className="size-4" /> Falar com o studio
              </a>
            )}
          </div>
        )}
      </section>

      {s.address && (appt.status === "CONFIRMED" || appt.status === "AWAITING_CONFIRMATION") && (
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-plum-700/80">
          <MapPin className="size-4 text-lavender-500" /> {s.address}
          {s.city ? ` · ${s.city}` : ""}
        </p>
      )}

      {(appt.status === "CONFIRMED" || appt.status === "AWAITING_CONFIRMATION") && (
        <p className="mt-6 text-center text-sm text-plum-700/80">
          Para remarcar ou acompanhar seus horários, acesse a{" "}
          <Link href="/minha-conta" className="text-lavender-700 underline decoration-lavender-300 underline-offset-4">
            área da cliente
          </Link>{" "}
          com o e-mail {appt.clientEmail}.
        </p>
      )}

      {(appt.status === "EXPIRED" || appt.status === "CANCELLED") && (
        <div className="mt-8 text-center">
          <Link href="/agendar" className="btn btn-primary">
            Fazer novo agendamento
          </Link>
        </div>
      )}

      <div className="mt-12 flex justify-center text-champagne-500">
        <Ornament />
      </div>
    </div>
  );
}

function Hero({ status, name }: { status: Appointment["status"]; name: string }) {
  const first = name.split(" ")[0];
  const map: Record<Appointment["status"], { icon: React.ReactNode; title: React.ReactNode; text: string }> = {
    PENDING_PAYMENT: { icon: <Clock />, title: <>Quase lá, <em className="text-lavender-600">{first}</em></>, text: "Seu horário está reservado. Conclua o pagamento para confirmar." },
    AWAITING_CONFIRMATION: { icon: <Hourglass />, title: <>Recebemos seu aviso, <em className="text-lavender-600">{first}</em></>, text: "Estamos conferindo o seu PIX. Assim que confirmarmos, seu horário estará garantido." },
    CONFIRMED: { icon: <CheckCircle2 />, title: <>Tudo certo, <em className="text-lavender-600">{first}</em>!</>, text: "Seu horário está garantido. Te esperamos com carinho 💜" },
    COMPLETED: { icon: <CheckCircle2 />, title: <>Obrigada, <em className="text-lavender-600">{first}</em></>, text: "Foi um prazer cuidar de você. Volte sempre!" },
    CANCELLED: { icon: <XCircle />, title: "Agendamento cancelado", text: "Esse agendamento foi cancelado. Se quiser, escolha um novo horário." },
    NO_SHOW: { icon: <XCircle />, title: "Agendamento encerrado", text: "Sentimos sua falta! Escolha um novo horário quando quiser." },
    EXPIRED: { icon: <Hourglass />, title: "O tempo de reserva acabou", text: "O pagamento não foi identificado a tempo e o horário foi liberado. Faça um novo agendamento." },
  };
  const m = map[status];
  return (
    <>
      <div className="mx-auto mt-6 grid size-16 place-items-center rounded-full bg-white text-lavender-600 shadow-card [&>svg]:size-7">{m.icon}</div>
      <h1 className="display mt-6 text-4xl sm:text-5xl">{m.title}</h1>
      <p className="mx-auto mt-3 max-w-md text-plum-700/80">{m.text}</p>
    </>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[0.65rem] tracking-[0.25em] text-plum-600/60 uppercase">{label}</p>
      <p className="mt-1.5 font-display text-xl text-plum-900">{value}</p>
    </div>
  );
}

function SwitchMethod({ appointmentId, method }: { appointmentId: string; method: "PIX" | "CARD" }) {
  return (
    <form action={switchMethodAction.bind(null, appointmentId, method)} className="mt-6">
      <SubmitButton className="text-xs text-lavender-700 underline decoration-lavender-300 underline-offset-4 hover:text-plum-900" pendingText="Gerando…">
        {method === "PIX" ? "Prefere pagar com PIX?" : "Prefere pagar com cartão de crédito?"}
      </SubmitButton>
    </form>
  );
}

function SimulateBox({ paymentId }: { paymentId: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-champagne-400 p-4">
      <p className="text-xs text-champagne-600">Modo demonstração — sem Mercado Pago configurado.</p>
      <Link href={`/pagamento/simulado/${paymentId}`} className="btn btn-soft btn-sm mt-3">
        Simular pagamento
      </Link>
    </div>
  );
}

function googleCalendarUrl(a: Appointment, studio: string, address: string) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = studioToDate(a.date, a.startMin);
  const end = studioToDate(a.date, a.endMin);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${a.serviceName} · ${studio}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Agendamento ${a.code}`,
    location: address,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
