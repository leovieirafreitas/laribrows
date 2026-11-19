"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authErrorMessage, requireClientUser, saveStoredProfile } from "@/lib/client-auth";
import { ClientActionError, cancelByClient, rescheduleByClient } from "@/lib/client-booking";
import { formatPhone, isValidPhone, onlyDigits } from "@/lib/format";
import { turnstileSiteKey } from "@/lib/env";
import { clientIp, MINUTE, tooMany } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/settings";
import { createSupabase } from "@/lib/supabase/server";
import { isValidDate } from "@/lib/time";

export type LoginState = { step: "email" | "code"; email: string; error?: string; info?: string } | null;

/** Passo 1: envia código (e link) de acesso para o e-mail. Cria a conta se ainda não existir. */
export async function sendCodeAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { step: "email", email, error: "Digite um e-mail válido." };
  // Protege a cota de e-mails: 5 pedidos de código por IP a cada 10 minutos.
  if (tooMany(`otp:ip:${await clientIp()}`, 5, 10 * MINUTE)) return { step: "email", email, error: authErrorMessage("rate limit", "send") };
  const captchaToken = String(fd.get("captchaToken") ?? "").slice(0, 4000) || undefined;
  if (turnstileSiteKey() && !captchaToken) return { step: "email", email, error: authErrorMessage("captcha", "send") };
  const supabase = await createSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: siteUrl(), captchaToken },
  });
  if (error) {
    console.error("[entrar] signInWithOtp", error.message);
    return { step: "email", email, error: authErrorMessage(error.message, "send") };
  }
  return { step: "code", email, info: "Enviamos um e-mail de acesso." };
}

/** Passo 2: confere o código digitado e inicia a sessão. */
export async function verifyCodeAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const token = onlyDigits(String(fd.get("code") ?? ""));
  if (token.length < 6) return { step: "code", email, error: "Digite o código que chegou no e-mail." };
  // Adivinhação de código: 8 tentativas por e-mail e 30 por IP a cada 10 minutos.
  if (tooMany(`otpv:email:${email}`, 8, 10 * MINUTE) || tooMany(`otpv:ip:${await clientIp()}`, 30, 10 * MINUTE)) {
    return { step: "code", email, error: authErrorMessage("rate limit", "verify") };
  }
  const supabase = await createSupabase();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, error: authErrorMessage(error.message, "verify") };
  redirect("/minha-conta");
}

export async function signOutAction() {
  const supabase = await createSupabase();
  await supabase.auth.signOut();
  redirect("/");
}

export type ProfileState = { ok: boolean; message: string } | null;

/** Nome e WhatsApp da cliente: confere e devolve já formatados (ou a mensagem de erro). */
function readProfile(fd: FormData): { name: string; phone: string } | { error: string } {
  const name = String(fd.get("name") ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const typed = String(fd.get("phone") ?? "");
  if (name.split(" ").length < 2 || name.length < 5) return { error: "Digite seu nome completo (nome e sobrenome)." };
  if (!isValidPhone(typed)) return { error: "Digite seu WhatsApp com DDD, por exemplo (92) 99999-9999." };
  return { name, phone: formatPhone(typed) };
}

/**
 * Grava o cadastro na tabela do sistema (fonte da verdade) e copia no perfil da conta,
 * renovando a sessão para o nome novo aparecer na hora.
 */
async function saveProfile(email: string, name: string, phone: string) {
  try {
    await saveStoredProfile(email, name, phone);
  } catch (e) {
    console.error("[cadastro] não salvou", e);
    return false;
  }
  try {
    const supabase = await createSupabase();
    const { error } = await supabase.auth.updateUser({ data: { name, phone } });
    if (!error) await supabase.auth.refreshSession();
  } catch {
    /* a cópia no perfil da conta é opcional */
  }
  return true;
}

export async function updateProfileAction(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await requireClientUser();
  const p = readProfile(fd);
  if ("error" in p) return { ok: false, message: p.error };
  if (!(await saveProfile(user.email, p.name, p.phone))) return { ok: false, message: "Não foi possível salvar agora." };
  revalidatePath("/minha-conta");
  return { ok: true, message: "Dados salvos." };
}

export type CompleteProfileState = { error: string; name: string; phone: string } | null;

/** Primeiro acesso: completa o cadastro e segue para onde a cliente queria ir. */
export async function completeProfileAction(_prev: CompleteProfileState, fd: FormData): Promise<CompleteProfileState> {
  const user = await requireClientUser();
  const p = readProfile(fd);
  const typed = { name: String(fd.get("name") ?? ""), phone: String(fd.get("phone") ?? "") };
  if ("error" in p) return { error: p.error, ...typed };
  if (!(await saveProfile(user.email, p.name, p.phone))) return { error: "Não foi possível salvar agora. Tente de novo.", ...typed };
  const raw = String(fd.get("next") ?? "");
  const next = /^\/(?![/\\])/.test(raw) && !raw.startsWith("/minha-conta/completar") ? raw : "/minha-conta";
  redirect(next);
}

export async function cancelMyAppointmentAction(appointmentId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireClientUser();
  try {
    await cancelByClient(appointmentId, user.email);
  } catch (e) {
    return { ok: false, message: e instanceof ClientActionError ? e.message : "Não foi possível cancelar agora." };
  }
  revalidatePath("/minha-conta");
  return { ok: true, message: "Agendamento cancelado." };
}

export async function rescheduleMyAppointmentAction(appointmentId: string, date: string, startMin: number): Promise<{ ok: boolean; message: string }> {
  const user = await requireClientUser();
  if (!isValidDate(date) || !Number.isInteger(startMin)) return { ok: false, message: "Escolha dia e horário." };
  try {
    await rescheduleByClient(appointmentId, user.email, date, startMin);
  } catch (e) {
    return { ok: false, message: e instanceof ClientActionError ? e.message : "Não foi possível remarcar agora." };
  }
  revalidatePath("/minha-conta");
  return { ok: true, message: "Agendamento remarcado." };
}
