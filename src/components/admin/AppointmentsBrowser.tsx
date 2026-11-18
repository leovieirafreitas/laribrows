"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AppointmentItem } from "@/components/admin/AppointmentItem";
import type { Appointment, AppointmentStatus } from "@/lib/db/schema";

const TABS = [
  { key: "proximos", label: "Próximos" },
  { key: "conferir", label: "PIX para conferir" },
  { key: "pagamento", label: "Aguardando pagamento" },
  { key: "passados", label: "Passados" },
  { key: "cancelados", label: "Cancelados" },
  { key: "todos", label: "Todos" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const has = (list: readonly AppointmentStatus[], s: AppointmentStatus) => list.includes(s);
const byDateAsc = (a: Appointment, b: Appointment) => a.date.localeCompare(b.date) || a.startMin - b.startMin;
const byDateDesc = (a: Appointment, b: Appointment) => -byDateAsc(a, b);

function filterTab(list: Appointment[], tab: TabKey, today: string) {
  switch (tab) {
    case "conferir":
      return list.filter((a) => a.status === "AWAITING_CONFIRMATION").sort(byDateAsc);
    case "pagamento":
      return list.filter((a) => a.status === "PENDING_PAYMENT").sort(byDateAsc);
    case "passados":
      return list.filter((a) => a.date < today && has(["CONFIRMED", "COMPLETED", "NO_SHOW"], a.status)).sort(byDateDesc);
    case "cancelados":
      return list.filter((a) => has(["CANCELLED", "EXPIRED"], a.status)).sort(byDateDesc);
    case "todos":
      return [...list].sort(byDateDesc);
    default:
      return list.filter((a) => a.date >= today && has(["CONFIRMED", "AWAITING_CONFIRMATION", "PENDING_PAYMENT", "COMPLETED"], a.status)).sort(byDateAsc);
  }
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Lista de agendamentos com abas e busca 100% no navegador:
 * os dados chegam uma vez e trocar de aba ou buscar é instantâneo (sem ir ao servidor).
 */
export function AppointmentsBrowser({ list, today, initialTab, initialQuery }: { list: Appointment[]; today: string; initialTab: string; initialQuery: string }) {
  const [tab, setTab] = useState<TabKey>(TABS.some((t) => t.key === initialTab) ? (initialTab as TabKey) : "proximos");
  const [query, setQuery] = useState(initialQuery);

  // Mantém a aba/busca no endereço (para recarregar ou compartilhar) sem recarregar a página.
  function syncUrl(nextTab: TabKey, nextQuery: string) {
    const params = new URLSearchParams();
    if (nextTab !== "proximos") params.set("aba", nextTab);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  const searched = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return list;
    const digits = q.replace(/\D/g, "");
    return list.filter(
      (a) =>
        normalize(a.clientName).includes(q) ||
        a.code.toLowerCase().includes(q) ||
        (digits.length >= 3 && a.clientPhone.replace(/\D/g, "").includes(digits)) ||
        normalize(a.serviceName).includes(q),
    );
  }, [list, query]);

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, filterTab(searched, t.key, today).length])), [searched, today]);
  const visible = useMemo(() => filterTab(searched, tab, today), [searched, tab, today]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-card">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                syncUrl(t.key, query);
              }}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs tracking-wide transition ${tab === t.key ? "bg-plum-900 text-white" : "text-plum-700 hover:bg-lavender-100"}`}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span
                  className={`min-w-5 rounded-full px-1.5 text-[0.62rem] tabular-nums ${tab === t.key ? "bg-white/20" : t.key === "conferir" ? "bg-champagne-400 text-plum-950" : "bg-lavender-100 text-lavender-700"}`}
                >
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute top-1/2 left-4 size-4 -translate-y-1/2 text-plum-600/40" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              syncUrl(tab, e.target.value);
            }}
            placeholder="Nome, telefone ou código"
            className="field rounded-full py-2.5 pr-9 pl-10 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                syncUrl(tab, "");
              }}
              className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-plum-600/50 hover:bg-lavender-100"
              aria-label="Limpar busca"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <section className="card mt-6 p-3 sm:p-4">
        {visible.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-plum-600/70">{query ? "Nada encontrado com essa busca." : "Nenhum agendamento por aqui."}</p>
        ) : (
          <div className="divide-y divide-lavender-100/70">
            {visible.map((a) => (
              <AppointmentItem key={a.id} a={a} showDate />
            ))}
          </div>
        )}
      </section>
      {tab === "todos" || tab === "passados" || tab === "cancelados" ? (
        <p className="mt-3 px-2 text-xs text-plum-600/50">Mostrando os últimos 6 meses e todos os próximos agendamentos.</p>
      ) : null}
    </>
  );
}
