"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, MessageCircle, Search, X } from "lucide-react";
import { formatBRL, formatPhone, whatsappLink } from "@/lib/format";
import { formatDateCompact, minToTime } from "@/lib/time";

export type ClientRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  bookings: number;
  visits: number;
  abandoned: number;
  paidCents: number;
  lastVisit: string | null;
  next: { date: string; startMin: number } | null;
  hasAccount: boolean;
  isNew: boolean; // primeiro contato nos últimos 30 dias
  real: boolean; // agendou ou criou conta (não só reserva abandonada)
};

const TABS = [
  { key: "todas", label: "Todas" },
  { key: "novas", label: "Novas (30 dias)" },
  { key: "conta", label: "Com conta no site" },
  { key: "nao-finalizaram", label: "Não finalizaram" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function filterTab(list: ClientRow[], tab: TabKey) {
  switch (tab) {
    case "novas":
      return list.filter((c) => c.real && c.isNew);
    case "conta":
      return list.filter((c) => c.hasAccount);
    case "nao-finalizaram":
      return list.filter((c) => !c.real && c.abandoned > 0);
    default:
      return list.filter((c) => c.real);
  }
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Lista de clientes com abas e busca no navegador (instantâneo). */
export function ClientsBrowser({ list, initialTab, initialQuery }: { list: ClientRow[]; initialTab: string; initialQuery: string }) {
  const [tab, setTab] = useState<TabKey>(TABS.some((t) => t.key === initialTab) ? (initialTab as TabKey) : "todas");
  const [query, setQuery] = useState(initialQuery);

  function syncUrl(nextTab: TabKey, nextQuery: string) {
    const params = new URLSearchParams();
    if (nextTab !== "todas") params.set("aba", nextTab);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  const searched = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return list;
    const digits = q.replace(/\D/g, "");
    return list.filter(
      (c) => normalize(c.name).includes(q) || c.email.includes(q) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)),
    );
  }, [list, query]);

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, filterTab(searched, t.key).length])), [searched]);
  const visible = useMemo(() => filterTab(searched, tab), [searched, tab]);

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
                <span className={`min-w-5 rounded-full px-1.5 text-[0.62rem] tabular-nums ${tab === t.key ? "bg-white/20" : "bg-lavender-100 text-lavender-700"}`}>
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
            placeholder="Nome, telefone ou e-mail"
            className="field rounded-full py-2.5 pr-9 pl-10 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                syncUrl(tab, "");
              }}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-plum-600/50 hover:text-plum-900"
              aria-label="Limpar busca"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {tab === "nao-finalizaram" && visible.length > 0 && (
        <p className="mt-4 text-xs text-plum-600/70">
          Pessoas que começaram a agendar mas não concluíram o pagamento. Vale chamar no WhatsApp.
        </p>
      )}

      <div className="card mt-5 p-2">
        {visible.length === 0 ? (
          <p className="p-10 text-center text-sm text-plum-600/70">
            {query ? "Nenhuma cliente encontrada." : tab === "todas" ? "Ainda não há clientes. Elas aparecem aqui ao agendar ou criar conta no site." : "Nada por aqui."}
          </p>
        ) : (
          <ul className="divide-y divide-lavender-100">
            {visible.map((c) => {
              const wa = c.phone ? whatsappLink(c.phone, `Olá, ${c.name.split(" ")[0]}! Aqui é do studio Lari Brows 💜`) : "";
              return (
                <li key={c.id} className="flex items-center gap-2">
                  <Link href={`/admin/clientes/${c.id}`} className="group flex min-w-0 flex-1 items-center gap-4 rounded-2xl px-3 py-3 transition hover:bg-lavender-50">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-lavender-100 font-display text-lg text-lavender-700">{initials(c.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate font-medium text-plum-900">{c.name}</span>
                        {c.isNew && c.real && <span className="rounded-full bg-champagne-200 px-2 py-0.5 text-[0.62rem] tracking-wide text-champagne-600">Nova</span>}
                        {c.hasAccount && <span className="rounded-full bg-lavender-100 px-2 py-0.5 text-[0.62rem] tracking-wide text-lavender-700">Conta no site</span>}
                        {!c.real && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[0.62rem] tracking-wide text-stone-600">Não finalizou</span>}
                      </p>
                      <p className="truncate text-sm text-plum-600/70">{[c.phone && formatPhone(c.phone), c.email].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="hidden shrink-0 text-right text-xs text-plum-600/70 md:block">
                      <p className="text-plum-800">
                        {c.next
                          ? `Próximo: ${formatDateCompact(c.next.date)} · ${minToTime(c.next.startMin)}`
                          : c.lastVisit
                            ? `Última vez: ${formatDateCompact(c.lastVisit)}`
                            : "Sem atendimentos"}
                      </p>
                      <p className="mt-0.5">
                        {c.visits} {c.visits === 1 ? "atendimento" : "atendimentos"}
                        {c.paidCents > 0 && ` · ${formatBRL(c.paidCents)} pagos`}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-plum-600/30 transition group-hover:translate-x-0.5 group-hover:text-lavender-600" />
                  </Link>
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                      className="mr-1 grid size-10 shrink-0 place-items-center rounded-full text-plum-600/60 transition hover:bg-lavender-100 hover:text-lavender-700"
                      aria-label={`WhatsApp de ${c.name}`}
                      title="Chamar no WhatsApp"
                    >
                      <MessageCircle className="size-4" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
