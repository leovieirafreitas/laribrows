"use server";

import { BookingError, checkBookable } from "@/lib/booking";
import {
  bookingSchema,
  clientFromAuthUser,
  finishDraft,
  getDraft,
  placeBooking,
  saveDraft,
  type BookingInput,
  type BookingResult,
} from "@/lib/booking-client";
import { authErrorMessage, getClientUser } from "@/lib/client-auth";
import { turnstileSiteKey } from "@/lib/env";
import { onlyDigits } from "@/lib/format";
import { clientIp, MINUTE, tooMany } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/settings";
import { createSupabase } from "@/lib/supabase/server";

/*
 * Agendamento pelo site:
 *  - Cliente com e-mail já confirmado (logada na área da cliente): grava e vai para o pagamento.
 *  - Sem e-mail confirmado: a cliente toca em Pagar → enviamos um código para o e-mail (nada é
 *    gravado no banco) → ela digita o código (ou toca no botão do e-mail) → só então o agendamento
 *    é gravado e ela segue para o checkout.
 */

/** Robôs segurando horários: no máximo 6 tentativas de reserva por IP a cada 10 minutos. */
async function bookingLimited() {
  return tooMany(`booking:ip:${await clientIp()}`, 6, 10 * MINUTE);
}
const LIMIT_MSG = "Muitas reservas seguidas. Aguarde alguns minutos ou fale com o studio pelo WhatsApp.";

/** Cliente com e-mail confirmado: grava o agendamento. */
export async function createBookingAction(input: BookingInput): Promise<BookingResult & { needsCode?: true }> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const client = await getClientUser();
  if (!client) return { ok: false, error: "Confirme seu e-mail para continuar.", needsCode: true };
  if (await bookingLimited()) return { ok: false, error: LIMIT_MSG };
  return placeBooking(parsed.data, client, await createSupabase());
}

export type SendCodeResult = { ok: true; draftId: string; email: string } | { ok: false; error: string };

/** Sem e-mail confirmado: confere o pedido e manda o código para o e-mail (sem gravar nada). */
export async function sendBookingCodeAction(input: BookingInput, captchaToken: string): Promise<SendCodeResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  if (await bookingLimited()) return { ok: false, error: LIMIT_MSG };
  // Protege a cota de e-mails: 5 pedidos de código por IP a cada 10 minutos (o mesmo limite do /entrar).
  if (tooMany(`otp:ip:${await clientIp()}`, 5, 10 * MINUTE)) return { ok: false, error: authErrorMessage("rate limit", "send") };
  const token = captchaToken.slice(0, 4000) || undefined;
  if (turnstileSiteKey() && !token) return { ok: false, error: authErrorMessage("captcha", "send") };

  try {
    await checkBookable(parsed.data);
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, error: err.message };
    console.error("[agendar] conferência", err);
    return { ok: false, error: "Algo deu errado ao agendar. Tente novamente." };
  }

  const email = parsed.data.clientEmail;
  const draftId = saveDraft(parsed.data);
  const supabase = await createSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // O botão do e-mail volta por /agendar/r/<pedido>/auth/confirm e já segue para o pagamento.
    options: { shouldCreateUser: true, emailRedirectTo: `${siteUrl()}/agendar/r/${draftId}`, captchaToken: token },
  });
  if (error) {
    console.error("[agendar] signInWithOtp", error.message);
    return { ok: false, error: authErrorMessage(error.message, "send") };
  }
  return { ok: true, draftId, email };
}

export type ConfirmCodeResult = (BookingResult & { verified?: true }) | { ok: false; error: string; expired: true };

/** Confere o código do e-mail; com o e-mail confirmado, grava o agendamento e devolve o pagamento. */
export async function confirmBookingCodeAction(draftId: string, code: string): Promise<ConfirmCodeResult> {
  const draft = getDraft(String(draftId));
  if (!draft) return { ok: false, error: "O código venceu. Toque em Pagar de novo para receber outro.", expired: true };
  // Já concluído pelo botão do e-mail: devolve o mesmo resultado (o código já foi usado pelo link).
  if (draft.result) {
    const client = await getClientUser();
    return { ...(await draft.result), ...(client?.email === draft.email ? { verified: true as const } : {}) };
  }

  const token = onlyDigits(String(code ?? ""));
  if (token.length < 6) return { ok: false, error: "Digite o código de 6 dígitos que chegou no e-mail." };
  // Adivinhação de código: 8 tentativas por e-mail e 30 por IP a cada 10 minutos.
  if (tooMany(`otpv:email:${draft.email}`, 8, 10 * MINUTE) || tooMany(`otpv:ip:${await clientIp()}`, 30, 10 * MINUTE)) {
    return { ok: false, error: authErrorMessage("rate limit", "verify") };
  }
  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.verifyOtp({ email: draft.email, token, type: "email" });
  if (error || !data.user) return { ok: false, error: authErrorMessage(error?.message ?? "invalid", "verify") };

  const client = clientFromAuthUser(data.user);
  if (client.email !== draft.email) return { ok: false, error: "Não foi possível confirmar o e-mail. Tente de novo." };
  return { ...(await finishDraft(draft, client, supabase)), verified: true };
}
