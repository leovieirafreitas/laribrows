import "server-only";
import { headers } from "next/headers";

/**
 * Limite de tentativas em memória (o site roda em um único servidor).
 * Protege login, envio de códigos e criação de reservas contra robôs e força bruta.
 */
type Bucket = { hits: number[] };
const g = globalThis as { __lbRate?: Map<string, Bucket> };
const store: Map<string, Bucket> = (g.__lbRate ??= new Map<string, Bucket>());
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of store) if (!b.hits.length || now - b.hits[b.hits.length - 1]! > 60 * 60_000) store.delete(k);
}

function recent(key: string, windowMs: number, now: number) {
  const b = store.get(key);
  if (!b) return [];
  b.hits = b.hits.filter((t) => now - t < windowMs);
  return b.hits;
}

/** Já estourou o limite? (não conta uma nova tentativa) */
export function isLimited(key: string, max: number, windowMs: number) {
  return recent(key, windowMs, Date.now()).length >= max;
}

/** Registra uma tentativa. */
export function hit(key: string) {
  const now = Date.now();
  sweep(now);
  const b = store.get(key) ?? { hits: [] };
  b.hits.push(now);
  if (b.hits.length > 200) b.hits.splice(0, b.hits.length - 200);
  store.set(key, b);
}

/** Conta a tentativa e diz se passou do limite. */
export function tooMany(key: string, max: number, windowMs: number) {
  if (isLimited(key, max, windowMs)) return true;
  hit(key);
  return false;
}

export function clearLimit(key: string) {
  store.delete(key);
}

/**
 * IP de quem está acessando. Atrás do proxy (EasyPanel/Traefik) vale o endereço que o
 * próprio proxy anotou: x-real-ip ou o ÚLTIMO item de x-forwarded-for (os primeiros podem ser forjados).
 */
export async function clientIp() {
  const h = await headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return fwd?.length ? fwd[fwd.length - 1]! : "desconhecido";
}

export const MINUTE = 60_000;
