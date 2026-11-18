"use server";

import bcrypt from "bcryptjs";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasConflict, loadScheduleContext } from "@/lib/availability";
import { approvePayment } from "@/lib/booking";
import { requireAdmin, startSession } from "@/lib/auth";
import { admins, appointments, dateOverrides, db, payments, services, settings, workingHours, type AppointmentStatus, type PaymentMethod } from "@/lib/db";
import { parseBRL } from "@/lib/format";
import { getSettings, invalidateSettingsCache } from "@/lib/settings";
import { addDays, dayIndex, isValidDate, timeToMin } from "@/lib/time";
import { notifyConfirmed, notifyRescheduled } from "@/lib/whatsapp-notify";

export type ActionState = { ok: boolean; message: string } | null;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const num = (fd: FormData, k: string, fallback = 0) => {
  const n = Number(str(fd, k));
  return Number.isFinite(n) ? n : fallback;
};
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
const time = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return /^\d{1,2}:\d{2}$/.test(v) ? timeToMin(v) : null;
};

function refreshAdmin() {
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}

/* ───────────────────────── Agendamentos ───────────────────────── */

/** Confirma um PIX manual (ou qualquer pagamento pendente) conferido pelo studio. */
export async function confirmPendingPaymentAction(appointmentId: string) {
  await requireAdmin();
  const p = await db.query.payments.findFirst({
    where: and(eq(payments.appointmentId, appointmentId), eq(payments.status, "PENDING")),
    orderBy: desc(payments.createdAt),
  });
  if (p) await approvePayment(p.id, { alertStudio: false });
  else {
    await db.update(appointments).set({ status: "CONFIRMED", expiresAt: null }).where(eq(appointments.id, appointmentId));
    notifyConfirmed(appointmentId, { alertStudio: false });
  }
  refreshAdmin();
}

/** Registra um pagamento recebido no studio (restante, dinheiro, maquininha...). */
export async function registerPaymentAction(appointmentId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const amount = parseBRL(str(fd, "amount"));
  const method = (str(fd, "method") || "PIX") as PaymentMethod;
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "Informe um valor válido." };
  const appt = await db.query.appointments.findFirst({ where: eq(appointments.id, appointmentId) });
  if (!appt) return { ok: false, message: "Agendamento não encontrado." };

  const [p] = await db
    .insert(payments)
    .values({
      appointmentId,
      provider: "studio",
      method,
      kind: appt.paidCents > 0 ? "REMAINING" : amount >= appt.totalCents ? "FULL" : "DEPOSIT",
      amountCents: amount,
      status: "PENDING",
    })
    .returning();
  await approvePayment(p.id);
  // Cancela cobranças online que ficaram pendentes
  await db
    .update(payments)
    .set({ status: "CANCELLED" })
    .where(and(eq(payments.appointmentId, appointmentId), eq(payments.status, "PENDING")));
  refreshAdmin();
  return { ok: true, message: "Pagamento registrado." };
}

const ALLOWED: AppointmentStatus[] = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export async function setStatusAction(appointmentId: string, status: AppointmentStatus) {
  await requireAdmin();
  if (!ALLOWED.includes(status)) return;
  if (status === "CONFIRMED") {
    // Reabrir uma reserva cancelada só se o horário continuar livre.
    const appt = await db.query.appointments.findFirst({ where: eq(appointments.id, appointmentId) });
    if (!appt) return;
    const ctx = await loadScheduleContext(await getSettings(), appt.date, appt.date, appt.id);
    if (hasConflict(ctx, appt.date, appt.startMin, appt.endMin)) return;
  }
  await db.update(appointments).set({ status, expiresAt: null }).where(eq(appointments.id, appointmentId));
  if (status === "CANCELLED") {
    await db
      .update(payments)
      .set({ status: "CANCELLED" })
      .where(and(eq(payments.appointmentId, appointmentId), eq(payments.status, "PENDING")));
  }
  refreshAdmin();
}

export async function rescheduleAction(appointmentId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const date = str(fd, "date");
  const start = time(fd, "time");
  const force = bool(fd, "force");
  if (!isValidDate(date) || start == null) return { ok: false, message: "Informe data e horário." };
  const appt = await db.query.appointments.findFirst({ where: eq(appointments.id, appointmentId) });
  if (!appt) return { ok: false, message: "Agendamento não encontrado." };
  const duration = appt.endMin - appt.startMin;
  const ctx = await loadScheduleContext(await getSettings(), date, date, appt.id);
  if (!force && hasConflict(ctx, date, start, start + duration)) {
    return { ok: false, message: "Já existe um atendimento nesse horário. Marque “encaixar mesmo assim” para forçar." };
  }
  await db.update(appointments).set({ date, startMin: start, endMin: start + duration }).where(eq(appointments.id, appointmentId));
  if (bool(fd, "notifyClient")) notifyRescheduled(appointmentId, { byClient: false, before: { date: appt.date, startMin: appt.startMin } });
  else await db.update(appointments).set({ waReminderSentAt: null }).where(eq(appointments.id, appointmentId)); // novo lembrete
  refreshAdmin();
  return { ok: true, message: "Agendamento remarcado." };
}

export async function saveAdminNotesAction(appointmentId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  await db.update(appointments).set({ adminNotes: str(fd, "adminNotes").slice(0, 2000) }).where(eq(appointments.id, appointmentId));
  refreshAdmin();
  return { ok: true, message: "Anotação salva." };
}

/** Agendamento lançado pelo próprio studio (WhatsApp, Instagram, balcão). */
export async function createManualAppointmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const service = await db.query.services.findFirst({ where: eq(services.id, str(fd, "serviceId")) });
  const date = str(fd, "date");
  const start = time(fd, "time");
  const name = str(fd, "clientName");
  const phone = str(fd, "clientPhone");
  if (!service) return { ok: false, message: "Escolha o procedimento." };
  if (!isValidDate(date) || start == null) return { ok: false, message: "Informe data e horário." };
  if (name.length < 2 || phone.replace(/\D/g, "").length < 10) return { ok: false, message: "Informe nome e WhatsApp da cliente." };

  const priceInput = str(fd, "price");
  const total = priceInput ? parseBRL(priceInput) : service.priceCents;
  const paid = str(fd, "paid") ? parseBRL(str(fd, "paid")) : 0;
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(paid) || paid < 0) return { ok: false, message: "Valores inválidos." };

  const ctx = await loadScheduleContext(await getSettings(), date, date);
  if (!bool(fd, "force") && hasConflict(ctx, date, start, start + service.durationMin)) {
    return { ok: false, message: "Já existe um atendimento nesse horário. Marque “encaixar mesmo assim” para forçar." };
  }

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = `LB${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => alphabet[b % alphabet.length]).join("")}`;
  const [appt] = await db
    .insert(appointments)
    .values({
      code,
      serviceId: service.id,
      serviceName: service.name,
      clientName: name,
      clientPhone: phone,
      clientEmail: str(fd, "clientEmail").toLowerCase(),
      notes: "",
      adminNotes: str(fd, "adminNotes"),
      date,
      startMin: start,
      endMin: start + service.durationMin,
      status: "CONFIRMED",
      totalCents: total,
      dueNowCents: 0,
    })
    .returning();

  if (paid > 0) {
    const [p] = await db
      .insert(payments)
      .values({
        appointmentId: appt.id,
        provider: "studio",
        method: (str(fd, "method") || "PIX") as PaymentMethod,
        kind: paid >= total ? "FULL" : "DEPOSIT",
        amountCents: paid,
      })
      .returning();
    await approvePayment(p.id);
  }
  if (bool(fd, "notifyClient")) notifyConfirmed(appt.id, { alertStudio: false });
  refreshAdmin();
  redirect(`/admin/agendamentos/${appt.id}`);
}

/* ───────────────────────── Procedimentos ───────────────────────── */

export async function saveServiceAction(serviceId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = str(fd, "name");
  const price = parseBRL(str(fd, "price"));
  const duration = num(fd, "durationMin");
  if (name.length < 2) return { ok: false, message: "Dê um nome ao procedimento." };
  if (!Number.isFinite(price) || price < 0) return { ok: false, message: "Preço inválido." };
  if (duration < 5 || duration > 600) return { ok: false, message: "Duração entre 5 e 600 minutos." };
  const values = {
    name,
    description: str(fd, "description").slice(0, 400),
    priceCents: price,
    durationMin: Math.round(duration),
    sortOrder: num(fd, "sortOrder"),
    active: bool(fd, "active"),
  };
  if (serviceId) await db.update(services).set(values).where(eq(services.id, serviceId));
  else await db.insert(services).values(values);
  refreshAdmin();
  return { ok: true, message: serviceId ? "Procedimento atualizado." : "Procedimento criado." };
}

export async function deleteServiceAction(serviceId: string) {
  await requireAdmin();
  const used = await db.$count(appointments, eq(appointments.serviceId, serviceId));
  if (used > 0) await db.update(services).set({ active: false }).where(eq(services.id, serviceId));
  else await db.delete(services).where(eq(services.id, serviceId));
  refreshAdmin();
}

/* ───────────────────────── Horários ───────────────────────── */

export async function saveWorkingHoursAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  for (let d = 0; d < 7; d++) {
    const isOpen = bool(fd, `open_${d}`);
    const startMin = time(fd, `start_${d}`) ?? 9 * 60;
    const endMin = time(fd, `end_${d}`) ?? 18 * 60;
    const bs = time(fd, `break_start_${d}`);
    const be = time(fd, `break_end_${d}`);
    if (isOpen && endMin <= startMin) return { ok: false, message: "O horário de fim precisa ser depois do início." };
    const hasBreak = bs != null && be != null && be > bs;
    const row = { weekday: d, isOpen, startMin, endMin, breakStartMin: hasBreak ? bs : null, breakEndMin: hasBreak ? be : null };
    await db.insert(workingHours).values(row).onConflictDoUpdate({ target: workingHours.weekday, set: row });
  }
  refreshAdmin();
  return { ok: true, message: "Horários salvos." };
}

export async function addOverrideAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const from = str(fd, "from");
  const to = str(fd, "to") || from;
  const type = str(fd, "type");
  const note = str(fd, "note").slice(0, 120);
  if (!isValidDate(from) || !isValidDate(to) || dayIndex(to) < dayIndex(from)) return { ok: false, message: "Período inválido." };
  if (dayIndex(to) - dayIndex(from) > 120) return { ok: false, message: "Período máximo de 120 dias." };
  const startMin = time(fd, "start");
  const endMin = time(fd, "end");
  if (type === "special" && (startMin == null || endMin == null || endMin <= startMin)) {
    return { ok: false, message: "Informe o horário especial (início e fim)." };
  }
  for (let d = from; dayIndex(d) <= dayIndex(to); d = addDays(d, 1)) {
    const row = {
      date: d,
      isClosed: type !== "special",
      startMin: type === "special" ? startMin : null,
      endMin: type === "special" ? endMin : null,
      note,
    };
    await db.insert(dateOverrides).values(row).onConflictDoUpdate({ target: dateOverrides.date, set: row });
  }
  refreshAdmin();
  return { ok: true, message: type === "special" ? "Horário especial salvo." : "Dias bloqueados." };
}

export async function deleteOverrideAction(date: string) {
  await requireAdmin();
  await db.delete(dateOverrides).where(eq(dateOverrides.date, date));
  refreshAdmin();
}

/** Bloqueio/desbloqueio rápido a partir da agenda. */
export async function toggleDayBlockAction(date: string, close: boolean) {
  await requireAdmin();
  if (!isValidDate(date)) return;
  if (close) {
    const row = { date, isClosed: true, startMin: null, endMin: null, note: "Bloqueado pela agenda" };
    await db.insert(dateOverrides).values(row).onConflictDoUpdate({ target: dateOverrides.date, set: row });
  } else {
    await db.delete(dateOverrides).where(eq(dateOverrides.date, date));
  }
  refreshAdmin();
}

/* ───────────────────────── Configurações ───────────────────────── */

export async function saveSettingsAction(section: "studio" | "payments" | "schedule", _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  await getSettings(); // garante a linha
  let patch: Partial<typeof settings.$inferInsert> = {};

  if (section === "studio") {
    if (!str(fd, "studioName")) return { ok: false, message: "Informe o nome do studio." };
    patch = {
      studioName: str(fd, "studioName").slice(0, 60),
      tagline: str(fd, "tagline").slice(0, 160),
      about: str(fd, "about").slice(0, 1200),
      whatsapp: str(fd, "whatsapp"),
      instagram: str(fd, "instagram"),
      address: str(fd, "address"),
      city: str(fd, "city"),
    };
  }

  if (section === "payments") {
    const chargeMode = str(fd, "chargeMode") as "deposit" | "full" | "none";
    const pct = Math.round(num(fd, "depositPercent", 50));
    if (!["deposit", "full", "none"].includes(chargeMode)) return { ok: false, message: "Modo de cobrança inválido." };
    if (pct < 1 || pct > 100) return { ok: false, message: "O sinal deve ser entre 1% e 100%." };
    const pixProvider = str(fd, "pixProvider") === "manual" ? "manual" : "mercadopago";
    const pixEnabled = bool(fd, "pixEnabled");
    const cardEnabled = bool(fd, "cardEnabled");
    if (chargeMode !== "none" && !pixEnabled && !cardEnabled) return { ok: false, message: "Ative pelo menos uma forma de pagamento." };
    if (pixEnabled && pixProvider === "manual" && !str(fd, "pixKey")) return { ok: false, message: "Informe a chave PIX do studio." };
    patch = {
      chargeMode,
      depositPercent: pct,
      allowFullPayment: bool(fd, "allowFullPayment"),
      pixEnabled,
      cardEnabled,
      pixProvider,
      pixKey: str(fd, "pixKey"),
      pixReceiverName: str(fd, "pixReceiverName"),
      pixReceiverCity: str(fd, "pixReceiverCity"),
      // Campos que só aparecem para um dos gateways: se não vieram no formulário, mantém o valor salvo.
      ...(fd.has("maxInstallments") ? { maxInstallments: Math.min(12, Math.max(1, Math.round(num(fd, "maxInstallments", 1)))) } : {}),
      ...(fd.has("cardFeeAbsorbedUpTo")
        ? { cardFeeAbsorbedUpTo: Math.min(12, Math.max(0, Math.round(num(fd, "cardFeeAbsorbedUpTo", 0)))) }
        : {}),
      cancellationPolicy: str(fd, "cancellationPolicy").slice(0, 800),
    };
  }

  if (section === "schedule") {
    patch = {
      slotIntervalMin: Math.min(120, Math.max(5, Math.round(num(fd, "slotIntervalMin", 30)))),
      bookingWindowDays: Math.min(365, Math.max(1, Math.round(num(fd, "bookingWindowDays", 60)))),
      minAdvanceHours: Math.min(168, Math.max(0, Math.round(num(fd, "minAdvanceHours", 2)))),
      holdMinutes: Math.min(240, Math.max(10, Math.round(num(fd, "holdMinutes", 30)))),
      clientChangeHours: Math.min(168, Math.max(0, Math.round(num(fd, "clientChangeHours", 24)))),
    };
  }

  await db.update(settings).set(patch).where(eq(settings.id, 1));
  invalidateSettingsCache();
  refreshAdmin();
  return { ok: true, message: "Configurações salvas." };
}

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const row = await db.query.admins.findFirst({ where: eq(admins.id, admin.id) });
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const email = str(fd, "email").toLowerCase();
  if (!row || !(await bcrypt.compare(current, row.passwordHash))) return { ok: false, message: "Senha atual incorreta." };
  if (next && next.length < 8) return { ok: false, message: "A nova senha precisa ter pelo menos 8 caracteres." };
  const [updated] = await db
    .update(admins)
    .set({
      name: str(fd, "name") || row.name,
      email: email || row.email,
      ...(next ? { passwordHash: await bcrypt.hash(next, 10) } : {}),
    })
    .where(eq(admins.id, admin.id))
    .returning();
  await startSession(updated); // o token guarda nome e e-mail
  refreshAdmin();
  return { ok: true, message: "Acesso atualizado." };
}
