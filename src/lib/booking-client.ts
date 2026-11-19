import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { BookingError, createBooking } from "@/lib/booking";
import { saveStoredProfile, storedProfile, type ClientUser } from "@/lib/client-auth";
import { formatPhone, isValidPhone } from "@/lib/format";
import { isValidDate } from "@/lib/time";

/** Dados do agendamento feito pelo site (o e-mail só vale depois de confirmado pelo código). */
export const bookingSchema = z.object({
  serviceId: z.string().min(1),
  date: z.string().refine(isValidDate, "Data inválida"),
  startMin: z.number().int().min(0).max(24 * 60),
  clientName: z.string().trim().min(3, "Informe seu nome completo").max(80),
  clientPhone: z
    .string()
    .trim()
    .refine(isValidPhone, "Digite seu WhatsApp com DDD, por exemplo (92) 99999-9999.")
    .transform(formatPhone),
  clientEmail: z.email("E-mail inválido").max(120).transform((v) => v.trim().toLowerCase()),
  notes: z.string().max(500).default(""),
  method: z.enum(["PIX", "CARD"]).nullable(),
  payOption: z.enum(["DEPOSIT", "FULL"]),
  accepted: z.literal(true, "Aceite a política de agendamento para continuar"),
});

export type BookingInput = z.input<typeof bookingSchema>;
export type BookingData = z.output<typeof bookingSchema>;
export type BookingResult = { ok: true; redirectTo: string; external: boolean } | { ok: false; error: string };

export function clientFromAuthUser(user: User): ClientUser {
  const meta = (user.user_metadata ?? {}) as { name?: string; phone?: string };
  return { id: user.id, email: (user.email ?? "").toLowerCase(), name: meta.name ?? "", phone: meta.phone ?? "" };
}

/**
 * Grava o agendamento de uma cliente com e-mail já confirmado (sessão da área da cliente).
 * O e-mail do agendamento é sempre o da sessão.
 */
export async function placeBooking(data: BookingData, client: ClientUser, supabase?: SupabaseClient): Promise<BookingResult> {
  const input = { ...data, clientEmail: client.email };
  if (!(await storedProfile(client.email).catch(() => null))) {
    await saveStoredProfile(client.email, input.clientName.trim(), input.clientPhone).catch(() => {});
  }
  if (supabase && (!client.name || !client.phone)) {
    const { error } = await supabase.auth
      .updateUser({ data: { name: client.name || input.clientName.trim(), phone: client.phone || input.clientPhone } })
      .catch(() => ({ error: true }));
    if (!error) await supabase.auth.refreshSession().catch(() => {});
  }
  try {
    const { redirectTo } = await createBooking(input);
    return { ok: true, redirectTo, external: /^https?:\/\//.test(redirectTo) };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, error: err.message };
    console.error("[agendar]", err);
    return { ok: false, error: "Algo deu errado ao agendar. Tente novamente." };
  }
}

/*
 * Pedido aguardando a confirmação do e-mail. Fica só na memória do servidor (nada vai para o
 * banco antes de a cliente confirmar o código) e vence junto com o código, em 1 hora.
 * O mesmo pedido pode ser concluído pelo código digitado no site ou pelo botão do e-mail:
 * o resultado é guardado para que os dois caminhos não criem dois agendamentos.
 */
type Draft = { id: string; email: string; data: BookingData; expiresAt: number; result?: Promise<BookingResult> };

const DRAFT_TTL = 60 * 60_000;
const MAX_DRAFTS = 5000;
const g = globalThis as unknown as { __lbBookingDrafts?: Map<string, Draft> };
const drafts = (g.__lbBookingDrafts ??= new Map<string, Draft>());

export function saveDraft(data: BookingData) {
  const now = Date.now();
  for (const [id, d] of drafts) if (d.expiresAt < now) drafts.delete(id);
  while (drafts.size >= MAX_DRAFTS) drafts.delete(drafts.keys().next().value!);
  const id = randomBytes(18).toString("base64url");
  drafts.set(id, { id, email: data.clientEmail, data, expiresAt: now + DRAFT_TTL });
  return id;
}

export function getDraft(id: string) {
  const d = drafts.get(id);
  if (!d) return null;
  if (d.expiresAt < Date.now()) {
    drafts.delete(id);
    return null;
  }
  return d;
}

/** Conclui o pedido uma única vez (as chamadas seguintes recebem o mesmo resultado). */
export function finishDraft(draft: Draft, client: ClientUser, supabase?: SupabaseClient) {
  draft.result ??= placeBooking(draft.data, client, supabase);
  return draft.result;
}
