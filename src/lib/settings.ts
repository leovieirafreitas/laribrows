import "server-only";
import { eq } from "drizzle-orm";
import { db, settings, type Settings } from "@/lib/db";

async function loadSettings(): Promise<Settings> {
  const row = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
  if (row) return row;
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  return (await db.query.settings.findFirst({ where: eq(settings.id, 1) }))!;
}

/*
 * As configurações mudam raramente e são lidas em quase toda página:
 * guardamos em memória por 30s (e limpamos na hora quando o painel salva).
 */
const SETTINGS_TTL_MS = 30_000;
const memo = globalThis as unknown as { __lbSettings?: { at: number; value: Promise<Settings> } };

export function getSettings(): Promise<Settings> {
  const hit = memo.__lbSettings;
  if (hit && Date.now() - hit.at < SETTINGS_TTL_MS) return hit.value;
  const value = loadSettings().catch((err) => {
    memo.__lbSettings = undefined; // não guarda erro
    throw err;
  });
  memo.__lbSettings = { at: Date.now(), value };
  return value;
}

export function invalidateSettingsCache() {
  memo.__lbSettings = undefined;
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
