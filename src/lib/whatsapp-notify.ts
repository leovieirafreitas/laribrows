import "server-only";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { after } from "next/server";
import { appointments, db, payments, whatsappMessages, type Appointment, type Settings, type WhatsappMessage } from "@/lib/db";
import { formatBRL } from "@/lib/format";
import { getSettings, siteUrl } from "@/lib/settings";
import { METHOD_LABEL } from "@/lib/status";
import { addDays, formatDateLong, minToTime, nowInStudio, studioToDate } from "@/lib/time";
import { getWhatsappStatus, sendWhatsappText, whatsappConfigured } from "@/lib/whatsapp";

import { DEFAULT_CONFIRM_TEMPLATE, DEFAULT_REMINDER_TEMPLATE, renderTemplate, type Vars } from "@/lib/whatsapp-templates";

function varsFor(a: Appointment, s: Settings, extra: Vars = {}): Vars {
  const remaining = Math.max(0, a.totalCents - a.paidCents);
  const today = nowInStudio().date;
  return {
    nome: a.clientName.trim().split(/\s+/)[0] ?? "",
    nome_completo: a.clientName.trim(),
    procedimento: a.serviceName,
    data: formatDateLong(a.date),
    hora: minToTime(a.startMin),
    quando: a.date === today ? "hoje" : a.date === addDays(today, 1) ? "amanhã" : `de ${formatDateLong(a.date).toLowerCase()}`,
    endereco: [s.address, s.city].filter(Boolean).join(", "),
    valor_pago: a.paidCents > 0 ? formatBRL(a.paidCents) : "",
    restante: remaining > 0 ? formatBRL(remaining) : "R$ 0,00 (quitado)",
    codigo: a.code,
    link: `${siteUrl()}/agendamento/${a.id}`,
    studio: s.studioName,
    telefone: a.clientPhone,
    link_painel: `${siteUrl()}/admin/agendamentos/${a.id}`,
    ...extra,
  };
}

/* ───────────── Envio + histórico ───────────── */

async function deliver(opts: { appointmentId?: string | null; to: string; kind: WhatsappMessage["kind"]; text: string }) {
  try {
    const number = await sendWhatsappText(opts.to, opts.text);
    await db.insert(whatsappMessages).values({ appointmentId: opts.appointmentId ?? null, toNumber: number, kind: opts.kind, status: "enviada", preview: opts.text.slice(0, 280) });
    return { ok: true as const };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[whatsapp]", opts.kind, error);
    await db
      .insert(whatsappMessages)
      .values({ appointmentId: opts.appointmentId ?? null, toNumber: opts.to, kind: opts.kind, status: "falhou", error: error.slice(0, 500), preview: opts.text.slice(0, 280) })
      .catch(() => {});
    return { ok: false as const, error };
  }
}

/** Roda depois de responder a quem pediu (não atrasa o pagamento nem o painel). */
export function inBackground(task: () => Promise<unknown>) {
  const run = () => task().catch((e) => console.error("[whatsapp]", e));
  try {
    after(run);
  } catch {
    void run(); // fora de uma requisição (ex.: rotina de lembretes)
  }
}

/** Número que recebe os avisos do studio: o WhatsApp de Configurações ou, sem ele, o próprio número conectado. */
async function studioNumber(s: Settings) {
  if (s.whatsapp.replace(/\D/g, "").length >= 10) return s.whatsapp;
  const st = await getWhatsappStatus();
  return "number" in st ? st.number : "";
}

async function alertStudio(a: Appointment, s: Settings, kind: "novo" | "cancelado" | "remarcado", extra: Vars = {}) {
  if (!s.waStudioAlerts) return;
  const to = await studioNumber(s);
  if (!to) return;
  const v = varsFor(a, s, extra);
  let text = "";
  if (kind === "novo") {
    const pay = await db.query.payments.findFirst({
      where: and(eq(payments.appointmentId, a.id), eq(payments.status, "APPROVED")),
      orderBy: desc(payments.paidAt),
    });
    text = renderTemplate(
      `✨ *Novo agendamento*\n\n{nome_completo}\n{procedimento}\n📅 {data} às {hora}\n💳 Pago: {valor_pago}${pay ? ` (${METHOD_LABEL[pay.method]})` : ""} · Restante: {restante}\n📱 {telefone}\nCódigo {codigo}\n\n{link_painel}`,
      v,
    );
  } else if (kind === "cancelado") {
    text = renderTemplate(`❌ *Cancelamento pela cliente*\n\n{nome_completo}\n{procedimento}\n📅 {data} às {hora}\n📱 {telefone}\nCódigo {codigo}\n\n{link_painel}`, v);
  } else {
    text = renderTemplate(`🔁 *Remarcação pela cliente*\n\n{nome_completo}\n{procedimento}\nAntes: {antes}\nAgora: 📅 {data} às {hora}\n📱 {telefone}\nCódigo {codigo}\n\n{link_painel}`, v);
  }
  await deliver({ appointmentId: a.id, to, kind: "studio", text });
}

async function sendConfirmation(a: Appointment, s: Settings) {
  if (!s.waConfirmEnabled || !a.clientPhone) return;
  const text = renderTemplate(s.waConfirmTemplate.trim() || DEFAULT_CONFIRM_TEMPLATE, varsFor(a, s));
  await deliver({ appointmentId: a.id, to: a.clientPhone, kind: "confirmacao", text });
}

/* ───────────── Gatilhos ───────────── */

/**
 * Agendamento confirmado (pagamento aprovado, PIX conferido, agendamento sem cobrança ou lançado no painel).
 * Envia uma única vez por agendamento: a marcação wa_confirm_sent_at é feita antes de enviar.
 */
export function notifyConfirmed(appointmentId: string, opts: { alertStudio: boolean }) {
  if (!whatsappConfigured()) return;
  inBackground(async () => {
    const [a] = await db
      .update(appointments)
      .set({ waConfirmSentAt: new Date() })
      .where(and(eq(appointments.id, appointmentId), eq(appointments.status, "CONFIRMED"), isNull(appointments.waConfirmSentAt)))
      .returning();
    if (!a) return;
    const s = await getSettings();
    await sendConfirmation(a, s);
    if (opts.alertStudio) await alertStudio(a, s, "novo");
  });
}

/** Horário remarcado (pela cliente ou pelo painel): manda a confirmação do novo horário e libera um novo lembrete. */
export function notifyRescheduled(appointmentId: string, opts: { byClient: boolean; before: { date: string; startMin: number } }) {
  if (!whatsappConfigured()) return;
  inBackground(async () => {
    const [a] = await db
      .update(appointments)
      .set({ waConfirmSentAt: new Date(), waReminderSentAt: null })
      .where(eq(appointments.id, appointmentId))
      .returning();
    if (!a || a.status !== "CONFIRMED") return;
    const s = await getSettings();
    await sendConfirmation(a, s);
    if (opts.byClient) await alertStudio(a, s, "remarcado", { antes: `${formatDateLong(opts.before.date)} às ${minToTime(opts.before.startMin)}` });
  });
}

export function notifyCancelledByClient(appointmentId: string) {
  if (!whatsappConfigured()) return;
  inBackground(async () => {
    const a = await db.query.appointments.findFirst({ where: eq(appointments.id, appointmentId) });
    if (a) await alertStudio(a, await getSettings(), "cancelado");
  });
}

/** Mensagem de teste a partir do painel. */
export async function sendTestMessage(phone: string) {
  const s = await getSettings();
  return deliver({ to: phone, kind: "teste", text: `✅ Teste do painel ${s.studioName}: o WhatsApp está conectado e enviando mensagens.` });
}

/* ───────────── Lembretes ───────────── */

const HOUR = 60 * 60 * 1000;

/** Envia o lembrete ~24h antes (até 2h antes do horário). Chamado a cada 5 minutos pelo servidor. */
export async function sendDueReminders() {
  if (!whatsappConfigured()) return 0;
  const s = await getSettings();
  if (!s.waReminderEnabled) return 0;
  const today = nowInStudio().date;
  const candidates = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.status, "CONFIRMED"),
        isNull(appointments.waReminderSentAt),
        gte(appointments.date, today),
        lte(appointments.date, addDays(today, 2)),
      ),
    );
  const now = Date.now();
  const due = candidates.filter((a) => {
    const start = studioToDate(a.date, a.startMin).getTime();
    // Marcou com antecedência (não manda lembrete para quem agendou para daqui a poucas horas).
    return now >= start - 24 * HOUR && now < start - 2 * HOUR && a.createdAt.getTime() <= start - 20 * HOUR && a.clientPhone;
  });
  if (!due.length) return 0;

  // Só gasta os lembretes se o WhatsApp estiver conectado (senão tenta de novo na próxima rodada).
  const st = await getWhatsappStatus();
  if (st.state !== "open") return 0;

  let sent = 0;
  for (const cand of due) {
    const [a] = await db
      .update(appointments)
      .set({ waReminderSentAt: new Date() })
      .where(and(eq(appointments.id, cand.id), isNull(appointments.waReminderSentAt)))
      .returning();
    if (!a) continue;
    const text = renderTemplate(s.waReminderTemplate.trim() || DEFAULT_REMINDER_TEMPLATE, varsFor(a, s));
    if ((await deliver({ appointmentId: a.id, to: a.clientPhone, kind: "lembrete", text })).ok) sent++;
  }
  return sent;
}

export async function recentWhatsappMessages(limit = 20) {
  return db.select().from(whatsappMessages).orderBy(desc(whatsappMessages.createdAt)).limit(limit);
}
