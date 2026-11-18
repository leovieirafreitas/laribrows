import "server-only";
import { eq } from "drizzle-orm";
import { db, settings, type Settings } from "@/lib/db";

export async function getSettings(): Promise<Settings> {
  const row = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
  if (row) return row;
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  return (await db.query.settings.findFirst({ where: eq(settings.id, 1) }))!;
}

export function mercadoPagoConfigured() {
  return Boolean(process.env.MP_ACCESS_TOKEN?.trim());
}

export function mercadoPagoIsTest() {
  return process.env.MP_ACCESS_TOKEN?.startsWith("TEST-") ?? false;
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Valor cobrado no ato do agendamento. */
export function computeDueNow(s: Settings, totalCents: number, payOption: "DEPOSIT" | "FULL") {
  if (s.chargeMode === "none") return 0;
  if (s.chargeMode === "full") return totalCents;
  if (payOption === "FULL" && s.allowFullPayment) return totalCents;
  const pct = Math.min(100, Math.max(1, s.depositPercent));
  return Math.round((totalCents * pct) / 100);
}

/** Configuração pública, segura para mandar ao navegador. */
export function publicSettings(s: Settings) {
  return {
    studioName: s.studioName,
    chargeMode: s.chargeMode,
    depositPercent: s.depositPercent,
    allowFullPayment: s.allowFullPayment,
    pixEnabled: s.pixEnabled,
    cardEnabled: s.cardEnabled,
    maxInstallments: s.maxInstallments,
    cancellationPolicy: s.cancellationPolicy,
  };
}
export type PublicSettings = ReturnType<typeof publicSettings>;
