import "server-only";
import { sql } from "drizzle-orm";
import { cache } from "react";
import { appointments, db, type AppointmentStatus } from "@/lib/db";
import { nowInStudio } from "@/lib/time";

/**
 * Clientes do studio, montadas a partir de:
 * - agendamentos (site, WhatsApp/balcão lançados no painel);
 * - contas criadas na área da cliente (Supabase Auth).
 * A mesma pessoa é reconhecida pelo e-mail ou, sem e-mail, pelo telefone.
 */
export type ClientSummary = {
  id: string; // para a URL (/admin/clientes/[id])
  name: string;
  email: string;
  phone: string;
  firstSeen: string; // ISO — primeiro agendamento ou criação da conta
  lastActivity: string; // ISO — último agendamento feito ou último acesso
  bookings: number; // agendamentos válidos (sem reservas que venceram sem pagamento)
  visits: number; // atendimentos realizados (concluídos ou confirmados com data passada)
  cancelled: number;
  abandoned: number; // reservas que venceram sem pagamento
  paidCents: number;
  lastVisit: string | null; // YYYY-MM-DD
  next: { date: string; startMin: number } | null;
  hasAccount: boolean;
  lastSignIn: string | null;
  isNew: boolean; // primeiro contato nos últimos 30 dias
  appointmentIds: string[];
};

type Row = {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  date: string;
  startMin: number;
  status: AppointmentStatus;
  paidCents: number;
  createdAt: Date;
};

type Account = { email: string; name: string | null; phone: string | null; created_at: Date; last_sign_in_at: Date | null };

const digits = (s: string) => s.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
const toId = (key: string) => Buffer.from(key).toString("base64url");
const iso = (d: Date) => d.toISOString();

async function loadAccounts(): Promise<Account[]> {
  try {
    const r = await db.execute(sql`
      select lower(email) as email, raw_user_meta_data->>'name' as name, raw_user_meta_data->>'phone' as phone,
             created_at, last_sign_in_at
      from auth.users where email is not null and deleted_at is null and email_confirmed_at is not null`);
    return (r as unknown as { rows: Account[] }).rows ?? (r as unknown as Account[]);
  } catch {
    return []; // banco local (sem Supabase Auth)
  }
}

export const getClients = cache(async (): Promise<ClientSummary[]> => {
  const [rows, accounts] = await Promise.all([
    db
      .select({
        id: appointments.id,
        clientName: appointments.clientName,
        clientEmail: appointments.clientEmail,
        clientPhone: appointments.clientPhone,
        date: appointments.date,
        startMin: appointments.startMin,
        status: appointments.status,
        paidCents: appointments.paidCents,
        createdAt: appointments.createdAt,
      })
      .from(appointments)
      .orderBy(appointments.createdAt)
      .limit(50000) as Promise<Row[]>,
    loadAccounts(),
  ]);

  const now = nowInStudio();
  const byKey = new Map<string, ClientSummary>();
  const keyByPhone = new Map<string, string>();

  const touch = (key: string, init: () => ClientSummary) => {
    let c = byKey.get(key);
    if (!c) byKey.set(key, (c = init()));
    return c;
  };
  const blank = (key: string, at: Date): ClientSummary => ({
    id: toId(key),
    name: "",
    email: "",
    phone: "",
    firstSeen: iso(at),
    lastActivity: iso(at),
    bookings: 0,
    visits: 0,
    cancelled: 0,
    abandoned: 0,
    paidCents: 0,
    lastVisit: null,
    next: null,
    hasAccount: false,
    lastSignIn: null,
    isNew: false,
    appointmentIds: [],
  });

  // Agendamentos com e-mail primeiro: eles definem a pessoa; os só com telefone se juntam a ela.
  const sorted = [...rows].sort((a, b) => Number(!a.clientEmail) - Number(!b.clientEmail) || +a.createdAt - +b.createdAt);
  for (const a of sorted) {
    const email = a.clientEmail.trim().toLowerCase();
    const phone = digits(a.clientPhone);
    const key = email || (phone && keyByPhone.get(phone)) || `tel:${phone || a.id}`;
    const c = touch(key, () => blank(key, a.createdAt));
    if (phone && !keyByPhone.has(phone)) keyByPhone.set(phone, key);

    // Dados de contato: os do agendamento mais recente. O nome preenchido pela própria cliente
    // (agendamentos com e-mail) vale mais que o lançado só com telefone.
    if (a.clientName && (email || !c.email)) c.name = a.clientName;
    if (a.clientPhone) c.phone = a.clientPhone;
    if (email) c.email = email;
    if (iso(a.createdAt) < c.firstSeen) c.firstSeen = iso(a.createdAt);
    if (iso(a.createdAt) > c.lastActivity) c.lastActivity = iso(a.createdAt);
    c.appointmentIds.push(a.id);
    c.paidCents += a.paidCents;

    if (a.status === "EXPIRED") {
      c.abandoned++;
      continue;
    }
    if (a.status === "CANCELLED") {
      c.cancelled++;
      continue;
    }
    c.bookings++;
    const past = a.date < now.date || (a.date === now.date && a.startMin < now.minutes);
    if (a.status === "COMPLETED" || (a.status === "CONFIRMED" && past)) {
      c.visits++;
      if (!c.lastVisit || a.date > c.lastVisit) c.lastVisit = a.date;
    }
    if (!past && (a.status === "CONFIRMED" || a.status === "AWAITING_CONFIRMATION" || a.status === "PENDING_PAYMENT")) {
      if (!c.next || a.date < c.next.date || (a.date === c.next.date && a.startMin < c.next.startMin)) c.next = { date: a.date, startMin: a.startMin };
    }
  }

  // Contas da área da cliente (algumas ainda sem agendamento).
  for (const acc of accounts) {
    const created = new Date(acc.created_at);
    const c = touch(acc.email, () => blank(acc.email, created));
    c.hasAccount = true;
    c.email = acc.email;
    if (!c.name && acc.name) c.name = acc.name;
    if (!c.phone && acc.phone) c.phone = acc.phone;
    if (iso(created) < c.firstSeen) c.firstSeen = iso(created);
    if (acc.last_sign_in_at) {
      const last = iso(new Date(acc.last_sign_in_at));
      c.lastSignIn = last;
      if (last > c.lastActivity) c.lastActivity = last;
    }
  }

  const recent = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return [...byKey.values()]
    .map((c) => ({ ...c, name: c.name || c.email.split("@")[0] || "Sem nome", isNew: c.firstSeen >= recent }))
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
});

/** Clientes "de verdade": agendou (sem contar reservas abandonadas) ou criou conta no site. */
export const isRealClient = (c: ClientSummary) => c.bookings > 0 || c.cancelled > 0 || c.hasAccount;

export async function getClientStats() {
  const clients = (await getClients()).filter(isRealClient);
  const monthStart = `${nowInStudio().date.slice(0, 7)}-01`;
  const newThisMonth = clients.filter((c) => nowInStudio(new Date(c.firstSeen)).date >= monthStart).length;
  return { total: clients.length, newThisMonth, withAccount: clients.filter((c) => c.hasAccount).length };
}
