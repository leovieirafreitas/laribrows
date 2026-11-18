/**
 * Roda uma vez quando o servidor sobe: liga a rotina de lembretes de WhatsApp
 * (a cada 5 minutos). Só no servidor Node em execução — não durante o build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startReminderLoop } = await import("./lib/whatsapp-reminders");
  startReminderLoop();
}
