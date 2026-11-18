/**
 * Datas do studio são guardadas como "YYYY-MM-DD" e horários como minutos
 * desde a meia-noite, sempre no fuso do studio (Manaus). Assim a agenda não sofre com
 * o fuso do servidor (que em produção costuma ser UTC).
 * Este arquivo é usado no servidor e no navegador.
 */
export const STUDIO_TZ = "America/Manaus"; // UTC−4, sem horário de verão
export const STUDIO_TZ_LABEL = "horário de Manaus";

const pad = (n: number) => String(n).padStart(2, "0");

export function nowInStudio(at: Date = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STUDIO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function todayInStudio() {
  return nowInStudio().date;
}

function toUTC(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function isValidDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const dt = toUTC(date);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === date;
}

/** Número de dias desde 1970-01-01 (para comparar datas facilmente). */
export function dayIndex(date: string) {
  return Math.round(toUTC(date).getTime() / 86_400_000);
}

export function addDays(date: string, n: number) {
  const dt = toUTC(date);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function weekdayOf(date: string) {
  return toUTC(date).getUTCDay();
}

export function minToTime(min: number) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function timeToMin(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`;
}

export function monthDates(month: string) {
  return Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${pad(i + 1)}`);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { ...opts, timeZone: "UTC" });

/** "Segunda-feira, 24 de novembro" */
export function formatDateLong(date: string) {
  return cap(fmt({ weekday: "long", day: "numeric", month: "long" }).format(toUTC(date)));
}

/** "24/11/2026" */
export function formatDateShort(date: string) {
  return fmt({ day: "2-digit", month: "2-digit", year: "numeric" }).format(toUTC(date));
}

/** "Seg, 24 nov" */
export function formatDateCompact(date: string) {
  return cap(fmt({ weekday: "short", day: "numeric", month: "short" }).format(toUTC(date)).replace(/\./g, ""));
}

/** "Novembro de 2026" */
export function formatMonth(month: string) {
  return cap(fmt({ month: "long", year: "numeric" }).format(toUTC(`${month}-01`)));
}

export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAYS_LONG = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

/** Diferença do fuso do studio para UTC, em minutos, no instante dado (Manaus = −240). */
export function studioOffsetMinutes(at: Date = new Date()) {
  const tz =
    new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TZ, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = tz.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Converte data+minuto do studio para o instante real (UTC). */
export function studioToDate(date: string, minutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  return new Date(naive - studioOffsetMinutes(new Date(naive)) * 60_000);
}

/** Instante no formato ISO com o fuso do studio: "2026-11-17T21:30:00.000-04:00". */
export function toStudioIso(at: Date) {
  const off = studioOffsetMinutes(at);
  const local = new Date(at.getTime() + off * 60_000);
  const abs = Math.abs(off);
  return local.toISOString().replace("Z", `${off < 0 ? "-" : "+"}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`);
}

/** "18/11/2026, 14:05" no fuso do studio. */
export function formatStudioDateTime(at: Date) {
  return at.toLocaleString("pt-BR", { timeZone: STUDIO_TZ, dateStyle: "short", timeStyle: "short" });
}
