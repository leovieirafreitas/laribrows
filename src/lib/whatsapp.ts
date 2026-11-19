import "server-only";
import { phoneWithCountry } from "@/lib/format";

/**
 * WhatsApp pela Evolution API (v2). Usa o token da própria instância — não a chave
 * geral do servidor —, então o site só consegue mexer na instância do studio.
 *   EVOLUTION_API_URL      https://evolution-api-...easypanel.host
 *   EVOLUTION_INSTANCE     laribrows
 *   EVOLUTION_API_KEY      token da instância
 */
function config() {
  const url = process.env.EVOLUTION_API_URL?.trim().replace(/\/$/, "") ?? "";
  const instance = process.env.EVOLUTION_INSTANCE?.trim() ?? "";
  const key = process.env.EVOLUTION_API_KEY?.trim() ?? "";
  return { url, instance, key };
}

export function whatsappConfigured() {
  const c = config();
  return Boolean(c.url && c.instance && c.key);
}

async function evo<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown, timeoutMs = 15_000): Promise<T> {
  const c = config();
  if (!c.url || !c.instance || !c.key) throw new Error("WhatsApp não configurado (EVOLUTION_API_URL / EVOLUTION_INSTANCE / EVOLUTION_API_KEY).");
  const res = await fetch(`${c.url}${path.replace("{instance}", encodeURIComponent(c.instance))}`, {
    method,
    cache: "no-store",
    headers: { apikey: c.key, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json().catch(() => ({}))) as T & { response?: { message?: unknown }; message?: unknown; error?: unknown };
  if (!res.ok) {
    const msg = JSON.stringify(data?.response?.message ?? data?.message ?? data?.error ?? res.statusText).slice(0, 300);
    const err = new Error(`Evolution API ${res.status}: ${msg}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

export type WhatsappStatus =
  | { state: "nao-configurado" }
  | { state: "erro"; message: string }
  | { state: "open" | "connecting" | "close"; number: string; name: string; picture: string };

/** Situação da conexão + número conectado. */
export async function getWhatsappStatus(timeoutMs = 8_000): Promise<WhatsappStatus> {
  if (!whatsappConfigured()) return { state: "nao-configurado" };
  try {
    type Inst = { connectionStatus?: string; ownerJid?: string | null; profileName?: string | null; profilePicUrl?: string | null };
    const r = await evo<Inst[] | Inst>("GET", `/instance/fetchInstances?instanceName={instance}`, undefined, timeoutMs);
    const inst = (Array.isArray(r) ? r[0] : r) ?? {};
    const state = inst.connectionStatus === "open" ? "open" : inst.connectionStatus === "connecting" ? "connecting" : "close";
    return {
      state,
      number: (inst.ownerJid ?? "").split("@")[0].replace(/\D/g, ""),
      name: inst.profileName ?? "",
      picture: inst.profilePicUrl ?? "",
    };
  } catch (e) {
    return { state: "erro", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Gera o QR Code para conectar (imagem em data URL). Se já estiver conectado, devolve null. */
export async function getWhatsappQr() {
  const r = await evo<{ base64?: string; code?: string; pairingCode?: string | null; instance?: { state?: string } }>("GET", "/instance/connect/{instance}");
  if (r.instance?.state === "open") return null;
  if (!r.base64) throw new Error("A Evolution API não devolveu o QR Code. Tente de novo em alguns segundos.");
  return { image: r.base64.startsWith("data:") ? r.base64 : `data:image/png;base64,${r.base64}`, pairingCode: r.pairingCode ?? null };
}

export async function logoutWhatsapp() {
  await evo("DELETE", "/instance/logout/{instance}");
}

/** Número no formato do WhatsApp: só dígitos, com DDI 55. */
export function toWhatsappNumber(phone: string) {
  return phoneWithCountry(phone);
}

/** "(92) 99519-9964" a partir de "5592995199964" (ou do número salvo pelo WhatsApp sem o 9). */
export function formatWhatsappNumber(n: string) {
  const d = n.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return n;
}

export async function sendWhatsappText(phone: string, text: string) {
  const number = toWhatsappNumber(phone);
  if (number.length < 12) throw new Error("Número de WhatsApp inválido.");
  await evo("POST", "/message/sendText/{instance}", { number, text, linkPreview: false }, 20_000);
  return number;
}
