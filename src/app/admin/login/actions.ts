"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { endSession, startSession } from "@/lib/auth";
import { admins, db } from "@/lib/db";
import { brandEmail, emailConfigured, sendEmail } from "@/lib/email";
import { adminFromResetToken, createResetToken, RESET_MINUTES } from "@/lib/password-reset";
import { clearLimit, clientIp, hit, isLimited, MINUTE, tooMany } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/settings";

// Hash fictício: compara mesmo quando o e-mail não existe (não revela quais e-mails existem).
const DUMMY_HASH = bcrypt.hashSync("senha-ficticia", 10);

export async function loginAction(_prev: { error: string; email: string } | null, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(form.get("password") ?? "").slice(0, 200);
  // Força bruta: no máximo 8 erros por e-mail e 20 por IP a cada 15 minutos.
  const ip = await clientIp();
  const keys = [`login:email:${email}`, `login:ip:${ip}`] as const;
  if (isLimited(keys[0], 8, 15 * MINUTE) || isLimited(keys[1], 20, 15 * MINUTE)) {
    return { error: "Muitas tentativas. Aguarde 15 minutos ou use “Esqueci minha senha”.", email };
  }
  const admin = await db.query.admins.findFirst({ where: eq(admins.email, email) });
  const ok = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !ok) {
    keys.forEach(hit);
    await new Promise((r) => setTimeout(r, 600));
    return { error: "E-mail ou senha incorretos.", email };
  }
  clearLimit(keys[0]);
  await startSession(admin);
  redirect("/admin");
}

export async function logoutAction() {
  await endSession();
  redirect("/admin/login");
}

// ───────────── Esqueci minha senha ─────────────

export type ResetRequestState = { sent?: boolean; error?: string; email: string } | null;

// Evita disparar vários e-mails seguidos para o mesmo endereço.
const lastRequest = ((globalThis as { __lbResetThrottle?: Map<string, number> }).__lbResetThrottle ??= new Map());

export async function requestPasswordResetAction(_prev: ResetRequestState, form: FormData): Promise<ResetRequestState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Digite um e-mail válido.", email };
  if (!emailConfigured()) {
    console.error("[redefinir-senha] RESEND_API_KEY / EMAIL_FROM não configurados");
    return { error: "O envio de e-mails não está configurado. Fale com o suporte do sistema.", email };
  }

  if (tooMany(`reset:ip:${await clientIp()}`, 6, 15 * MINUTE)) return { sent: true, email }; // mesma resposta, sem enviar
  const now = Date.now();
  if (now - (lastRequest.get(email) ?? 0) > 60_000) {
    lastRequest.set(email, now);
    const admin = await db.query.admins.findFirst({ where: eq(admins.email, email) });
    if (admin) {
      const url = `${siteUrl()}/admin/login/nova-senha?token=${await createResetToken(admin)}`;
      // Envia depois de responder: o tempo de resposta é o mesmo exista ou não o e-mail.
      after(() =>
        sendEmail({
          to: admin.email,
          subject: "Redefinir sua senha · Lari Brows",
          html: brandEmail({
            title: "Nova senha do painel",
            text: `Oi, ${admin.name}! Recebemos um pedido para redefinir a senha do painel. Toque no botão para criar uma senha nova.`,
            button: { label: "Criar nova senha", url },
            footer: `O link vale por ${RESET_MINUTES} minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail: sua senha continua a mesma.`,
          }),
          text: `Para criar uma nova senha do painel Lari Brows, abra: ${url}\n\nO link vale por ${RESET_MINUTES} minutos. Se não foi você, ignore este e-mail.`,
        }).catch((e) => console.error("[redefinir-senha] envio falhou:", e instanceof Error ? e.message : e)),
      );
    }
  }
  // Mesma resposta sempre: não revela quais e-mails têm acesso ao painel.
  return { sent: true, email };
}

export type NewPasswordState = { error: string } | null;

export async function resetPasswordAction(_prev: NewPasswordState, form: FormData): Promise<NewPasswordState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { error: "A nova senha precisa ter pelo menos 8 caracteres." };
  if (password !== confirm) return { error: "As duas senhas não são iguais." };
  const admin = await adminFromResetToken(token);
  if (!admin) return { error: "Este link expirou ou já foi usado. Peça um novo link." };
  const [updated] = await db
    .update(admins)
    .set({ passwordHash: await bcrypt.hash(password, 10) })
    .where(eq(admins.id, admin.id))
    .returning();
  clearLimit(`login:email:${updated.email}`);
  await startSession(updated);
  redirect("/admin?senha=redefinida");
}
