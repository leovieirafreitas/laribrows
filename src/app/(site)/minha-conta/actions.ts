"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireClientUser } from "@/lib/client-auth";
import { ClientActionError, cancelByClient, rescheduleByClient } from "@/lib/client-booking";
import { onlyDigits } from "@/lib/format";
import { clientIp, MINUTE, tooMany } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/settings";
import { createSupabase } from "@/lib/supabase/server";
import { isValidDate } from "@/lib/time";

export type LoginState = { step: "email" | "code"; email: string; error?: string; info?: string } | null;

function authErrorMessage(message: string, step: "send" | "verify") {
  if (/rate limit|too many|security purposes/i.test(message)) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  if (step === "send") {
    if (/email address .* invalid/i.test(message)) return "Esse e-mail não parece válido. Confira e tente de novo.";
    return "Não conseguimos enviar o e-mail agora. Tente novamente mais tarde ou fale com o studio.";
  }
  if (/expired|invalid/i.test(message)) return "Código inválido ou expirado. Confira o e-mail ou peça um novo código.";
  return "Não foi possível entrar agora. Tente novamente.";
}

/** Passo 1: envia código (e link) de acesso para o e-mail. Cria a conta se ainda não existir. */
export async function sendCodeAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { step: "email", email, error: "Digite um e-mail válido." };
  // Protege a cota de e-mails: 5 pedidos de código por IP a cada 10 minutos.
  if (tooMany(`otp:ip:${await clientIp()}`, 5, 10 * MINUTE)) return { step: "email", email, error: authErrorMessage("rate limit", "send") };
  const supabase = await createSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: siteUrl() },
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

export async function updateProfileAction(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  await requireClientUser();
  const name = String(fd.get("name") ?? "").trim().slice(0, 80);
  const phone = String(fd.get("phone") ?? "").trim();
  if (name.length < 3) return { ok: false, message: "Informe seu nome completo." };
  if (onlyDigits(phone).length < 10) return { ok: false, message: "Informe um WhatsApp válido." };
  const supabase = await createSupabase();
  const { error } = await supabase.auth.updateUser({ data: { name, phone } });
  if (error) return { ok: false, message: "Não foi possível salvar agora." };
  revalidatePath("/minha-conta");
  return { ok: true, message: "Dados salvos." };
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
