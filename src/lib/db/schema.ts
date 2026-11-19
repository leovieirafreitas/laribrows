import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/*
 * Banco Postgres (Supabase). Todas as tabelas têm RLS ligado e nenhuma
 * policy: a chave pública do Supabase não lê nada. O app acessa pelo
 * usuário do banco (DATABASE_URL), que não é afetado pelo RLS.
 */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();

/** Acesso ao painel. */
export const admins = pgTable("admins", {
  id: id(),
  name: text("name").notNull().default("Admin"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
}).enableRLS();

/** Procedimentos oferecidos (design, henna, micropigmentação...). */
export const services = pgTable("services", {
  id: id(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  durationMin: integer("duration_min").notNull(),
  priceCents: integer("price_cents").notNull(),
  /** Preço durante a promoção (ex.: Black Friday). Vazio = não entra na promoção. */
  promoPriceCents: integer("promo_price_cents"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
}).enableRLS();

/** Horário padrão de funcionamento por dia da semana (0 = domingo). */
export const workingHours = pgTable("working_hours", {
  weekday: integer("weekday").primaryKey(),
  isOpen: boolean("is_open").notNull().default(false),
  startMin: integer("start_min").notNull().default(9 * 60),
  endMin: integer("end_min").notNull().default(18 * 60),
  breakStartMin: integer("break_start_min"),
  breakEndMin: integer("break_end_min"),
}).enableRLS();

/**
 * Exceções no calendário: dia fechado (folga, feriado) ou dia com horário
 * especial. Também usado para ABRIR um dia que normalmente é fechado.
 */
export const dateOverrides = pgTable("date_overrides", {
  date: text("date").primaryKey(), // YYYY-MM-DD
  isClosed: boolean("is_closed").notNull().default(true),
  startMin: integer("start_min"),
  endMin: integer("end_min"),
  note: text("note").notNull().default(""),
}).enableRLS();

/**
 * Horários bloqueados dentro de um dia aberto (ex.: sábado das 18:00 às 19:15).
 * Ou vale para uma data (date) ou para toda semana naquele dia (weekday 0=domingo … 6=sábado).
 */
export const timeBlocks = pgTable(
  "time_blocks",
  {
    id: id(),
    date: text("date"), // YYYY-MM-DD (bloqueio de um dia)
    weekday: integer("weekday"), // 0–6 (bloqueio de toda semana)
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("time_blocks_date_idx").on(t.date)],
).enableRLS();

export type AppointmentStatus =
  | "PENDING_PAYMENT" // aguardando pagamento (segura o horário até expirar)
  | "AWAITING_CONFIRMATION" // cliente diz que pagou PIX manual, admin confere
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "EXPIRED";

export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    code: text("code").notNull().unique(), // código curto p/ cliente (ex: LB-4F7K2)
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id),
    serviceName: text("service_name").notNull(), // snapshot
    clientName: text("client_name").notNull(),
    clientPhone: text("client_phone").notNull(),
    clientEmail: text("client_email").notNull().default(""),
    notes: text("notes").notNull().default(""),
    date: text("date").notNull(), // YYYY-MM-DD (fuso do studio)
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    status: text("status").$type<AppointmentStatus>().notNull().default("PENDING_PAYMENT"),
    totalCents: integer("total_cents").notNull(),
    /** Quanto foi exigido online no agendamento (sinal ou total). */
    dueNowCents: integer("due_now_cents").notNull(),
    paidCents: integer("paid_cents").notNull().default(0),
    expiresAt: ts("expires_at"),
    adminNotes: text("admin_notes").notNull().default(""),
    /** Promoção usada no preço deste agendamento (ex.: "Black Friday"); vazio = preço normal. */
    promoLabel: text("promo_label").notNull().default(""),
    /** WhatsApp: quando a confirmação e o lembrete foram enviados (evita mandar duas vezes). */
    waConfirmSentAt: ts("wa_confirm_sent_at"),
    waReminderSentAt: ts("wa_reminder_sent_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("appointments_date_idx").on(t.date),
    index("appointments_status_idx").on(t.status),
    index("appointments_service_idx").on(t.serviceId),
  ],
).enableRLS();

export type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED";
export type PaymentMethod = "PIX" | "CARD" | "CASH" | "OTHER";
export type PaymentProvider = "infinitepay" | "mercadopago" | "pix_manual" | "simulated" | "studio";

export const payments = pgTable(
  "payments",
  {
    id: id(),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => appointments.id),
    provider: text("provider").$type<PaymentProvider>().notNull(),
    providerRef: text("provider_ref"), // id do pagamento/preferência no gateway
    method: text("method").$type<PaymentMethod>().notNull(),
    kind: text("kind").$type<"DEPOSIT" | "FULL" | "REMAINING">().notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").$type<PaymentStatus>().notNull().default("PENDING"),
    pixCode: text("pix_code"), // PIX copia-e-cola
    checkoutUrl: text("checkout_url"),
    paidAt: ts("paid_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("payments_appointment_idx").on(t.appointmentId),
    uniqueIndex("payments_provider_ref_idx").on(t.provider, t.providerRef),
  ],
).enableRLS();

/** Configurações do studio — linha única (id = 1). */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  studioName: text("studio_name").notNull().default("Lari Brows"),
  tagline: text("tagline").notNull().default("Design de sobrancelhas com elegância"),
  about: text("about").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),

  /** "deposit" = sinal %, "full" = valor total online, "none" = paga no studio */
  chargeMode: text("charge_mode").$type<"deposit" | "full" | "none">().notNull().default("deposit"),
  depositPercent: integer("deposit_percent").notNull().default(50),
  /** Com sinal ativo, deixar a cliente optar por pagar o total. */
  allowFullPayment: boolean("allow_full_payment").notNull().default(true),

  pixEnabled: boolean("pix_enabled").notNull().default(true),
  cardEnabled: boolean("card_enabled").notNull().default(true),
  /** "mercadopago" = PIX automático; "manual" = chave PIX do studio, admin confirma. */
  pixProvider: text("pix_provider").$type<"mercadopago" | "manual">().notNull().default("mercadopago"),
  pixKey: text("pix_key").notNull().default(""),
  pixReceiverName: text("pix_receiver_name").notNull().default(""),
  pixReceiverCity: text("pix_receiver_city").notNull().default(""),
  maxInstallments: integer("max_installments").notNull().default(3),
  /** InfinitePay: até quantas parcelas o studio assume a taxa do cartão (0 = a cliente paga a taxa sempre). */
  cardFeeAbsorbedUpTo: integer("card_fee_absorbed_up_to").notNull().default(0),

  slotIntervalMin: integer("slot_interval_min").notNull().default(30),
  bookingWindowDays: integer("booking_window_days").notNull().default(60),
  minAdvanceHours: integer("min_advance_hours").notNull().default(2),
  holdMinutes: integer("hold_minutes").notNull().default(30),
  /** Até quantas horas antes a cliente pode cancelar/remarcar pela área da cliente. */
  clientChangeHours: integer("client_change_hours").notNull().default(24),
  cancellationPolicy: text("cancellation_policy")
    .notNull()
    .default(
      "O sinal garante o seu horário e é abatido no valor do procedimento. Remarcações com até 24h de antecedência. Em caso de falta sem aviso, o sinal não é devolvido.",
    ),

  /* Promoção (ex.: Black Friday): vale para agendamentos feitos entre as datas (vazias = sem limite). */
  promoEnabled: boolean("promo_enabled").notNull().default(false),
  promoLabel: text("promo_label").notNull().default("Black Friday"),
  promoStart: text("promo_start").notNull().default(""), // YYYY-MM-DD
  promoEnd: text("promo_end").notNull().default(""), // YYYY-MM-DD (inclusive)

  /* WhatsApp (Evolution API). Textos vazios = modelo padrão do sistema. */
  waConfirmEnabled: boolean("wa_confirm_enabled").notNull().default(true),
  waConfirmTemplate: text("wa_confirm_template").notNull().default(""),
  waReminderEnabled: boolean("wa_reminder_enabled").notNull().default(true),
  waReminderTemplate: text("wa_reminder_template").notNull().default(""),
  /** Avisos para o próprio studio: novo agendamento, cancelamento e remarcação feitos pela cliente. */
  waStudioAlerts: boolean("wa_studio_alerts").notNull().default(true),
}).enableRLS();

/** Cadastro da cliente da área de membros (nome e WhatsApp), pelo e-mail da conta. */
export const clientProfiles = pgTable("client_profiles", {
  email: text("email").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}).enableRLS();

/** Histórico de mensagens de WhatsApp enviadas pelo sistema. */
export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: id(),
    appointmentId: text("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
    toNumber: text("to_number").notNull(),
    kind: text("kind").$type<"confirmacao" | "lembrete" | "studio" | "teste">().notNull(),
    status: text("status").$type<"enviada" | "falhou">().notNull(),
    error: text("error").notNull().default(""),
    preview: text("preview").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("whatsapp_messages_created_idx").on(t.createdAt)],
).enableRLS();

export type Admin = typeof admins.$inferSelect;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type WorkingHour = typeof workingHours.$inferSelect;
export type DateOverride = typeof dateOverrides.$inferSelect;
export type TimeBlock = typeof timeBlocks.$inferSelect;
