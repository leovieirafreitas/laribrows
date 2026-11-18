import { formatBRL } from "@/lib/format";

const monthShort = (m: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
    .format(new Date(`${m}-01T12:00:00Z`))
    .replace(".", "");

function niceMax(v: number) {
  if (v <= 0) return 100_00;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= v)!;
  return step * pow;
}

const compact = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);

/** Colunas de faturamento mensal — série única, tooltip ao passar o mouse. */
export function RevenueChart({ data }: { data: { month: string; cents: number }[] }) {
  const max = niceMax(Math.max(...data.map((d) => d.cents)));
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const last = data[data.length - 1];

  return (
    <figure>
      <div className="relative h-48 pl-12">
        {/* Grade */}
        {ticks.map((t) => (
          <div key={t} className="absolute right-0 left-12 border-t border-lavender-100" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="absolute -top-2 -left-12 w-10 text-right text-[0.65rem] text-plum-600/50 tabular-nums">R$ {compact(t)}</span>
          </div>
        ))}
        {/* Colunas */}
        <div className="absolute inset-y-0 right-0 left-12 flex items-end justify-around">
          {data.map((d) => {
            const h = (d.cents / max) * 100;
            const isLast = d.month === last.month;
            return (
              <div key={d.month} className="group relative flex h-full w-full flex-col items-center justify-end">
                {isLast && d.cents > 0 && (
                  <span className="mb-1.5 text-[0.7rem] font-medium text-plum-900 tabular-nums">{formatBRL(d.cents)}</span>
                )}
                <div
                  className={`w-6 rounded-t-[4px] transition ${isLast ? "bg-lavender-600" : "bg-lavender-600/45"} group-hover:bg-lavender-700`}
                  style={{ height: `${Math.max(h, d.cents > 0 ? 1.5 : 0)}%` }}
                />
                {/* área de hover maior que a coluna */}
                <span
                  style={{ bottom: `calc(${h}% + ${isLast && d.cents > 0 ? 28 : 8}px)` }}
                  className="pointer-events-none absolute z-10 hidden rounded-xl bg-plum-950 px-3 py-2 text-xs whitespace-nowrap text-white shadow-soft group-hover:block">
                  <span className="block text-lavender-200 capitalize">{monthShort(d.month)}</span>
                  {formatBRL(d.cents)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex justify-around pl-12 text-[0.7rem] text-plum-600/60 capitalize">
        {data.map((d) => (
          <span key={d.month} className="w-full text-center">
            {monthShort(d.month)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Faturamento recebido por mês</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th>{d.month}</th>
              <td>{formatBRL(d.cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
