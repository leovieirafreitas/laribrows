import { whatsappConfigured } from "@/lib/whatsapp";

const EVERY = 5 * 60 * 1000;
const state = globalThis as { __lbReminderLoop?: boolean };

/** Lembretes de WhatsApp: confere a cada 5 minutos quem tem horário nas próximas 24h. */
export function startReminderLoop() {
  if (state.__lbReminderLoop || !whatsappConfigured()) return;
  state.__lbReminderLoop = true;

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const { sendDueReminders } = await import("@/lib/whatsapp-notify");
      const sent = await sendDueReminders();
      if (sent) console.log(`[whatsapp] ${sent} lembrete(s) enviado(s)`);
    } catch (e) {
      console.error("[whatsapp] rotina de lembretes:", e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 30_000);
  setInterval(tick, EVERY).unref?.();
  console.log("[whatsapp] lembretes automáticos ligados");
}
