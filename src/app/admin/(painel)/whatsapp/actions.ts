"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db, settings } from "@/lib/db";
import { invalidateSettingsCache } from "@/lib/settings";
import { getWhatsappQr, getWhatsappStatus, logoutWhatsapp, type WhatsappStatus } from "@/lib/whatsapp";
import { sendTestMessage } from "@/lib/whatsapp-notify";
import { DEFAULT_CONFIRM_TEMPLATE, DEFAULT_REMINDER_TEMPLATE } from "@/lib/whatsapp-templates";

export type QrResult = { image: string } | { connected: true } | { error: string };
type ActionState = { ok: boolean; message: string } | null;

export async function whatsappStatusAction(): Promise<WhatsappStatus> {
  await requireAdmin();
  return getWhatsappStatus();
}

export async function whatsappQrAction(): Promise<QrResult> {
  await requireAdmin();
  try {
    const qr = await getWhatsappQr();
    return qr ? { image: qr.image } : { connected: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível gerar o QR Code." };
  }
}

export async function whatsappLogoutAction(): Promise<ActionState> {
  await requireAdmin();
  try {
    await logoutWhatsapp();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Não foi possível desconectar." };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "WhatsApp desconectado." };
}

export async function whatsappTestAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const phone = String(fd.get("phone") ?? "");
  if (phone.replace(/\D/g, "").length < 10) return { ok: false, message: "Digite um WhatsApp com DDD." };
  const r = await sendTestMessage(phone);
  revalidatePath("/admin/whatsapp");
  return r.ok ? { ok: true, message: "Mensagem de teste enviada." } : { ok: false, message: `Não foi enviada: ${r.error}` };
}

export async function saveWhatsappSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const tpl = (name: string, fallback: string) => {
    const v = String(fd.get(name) ?? "").replace(/\r\n/g, "\n").trim().slice(0, 2000);
    return v === fallback.trim() ? "" : v; // igual ao padrão: segue o modelo do sistema
  };
  const confirm = tpl("waConfirmTemplate", DEFAULT_CONFIRM_TEMPLATE);
  const reminder = tpl("waReminderTemplate", DEFAULT_REMINDER_TEMPLATE);
  await db
    .update(settings)
    .set({
      waConfirmEnabled: fd.get("waConfirmEnabled") === "on",
      waConfirmTemplate: confirm,
      waReminderEnabled: fd.get("waReminderEnabled") === "on",
      waReminderTemplate: reminder,
      waStudioAlerts: fd.get("waStudioAlerts") === "on",
    })
    .where(eq(settings.id, 1));
  invalidateSettingsCache();
  revalidatePath("/admin/whatsapp");
  return { ok: true, message: "Mensagens automáticas salvas." };
}
