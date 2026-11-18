"use client";

import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addMonths, formatDateCompact, formatMonth, minToTime, monthDates, timeToMin, todayInStudio, weekdayOf, WEEKDAYS_SHORT } from "@/lib/time";

/**
 * Seletores de data e horário no visual do studio (substituem os nativos do navegador).
 * Enviam o valor num <input type="hidden" name=...>, então funcionam em qualquer <form>.
 * O painel abre "solto" no <body> (por cima de cartões e rolagens), junto ao campo.
 */

/** Volta ao valor inicial quando o formulário é limpo (form.reset()). */
function useFormReset(input: React.RefObject<HTMLInputElement | null>, onReset: () => void) {
  const cb = useRef(onReset);
  useEffect(() => {
    cb.current = onReset;
  });
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const handler = () => cb.current();
    form.addEventListener("reset", handler);
    return () => form.removeEventListener("reset", handler);
  }, [input]);
}

/** Painel flutuante: posiciona junto ao campo, vira para cima se faltar espaço, fecha com clique fora/Esc. */
function FloatingPanel({
  anchor,
  onClose,
  align,
  className,
  children,
  ...aria
}: {
  anchor: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  align: "left" | "right";
  className: string;
  children: React.ReactNode;
  role: string;
  "aria-label": string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const p = panel.current;
      if (!a || !p) return;
      const gap = 8;
      const w = p.offsetWidth;
      const h = p.offsetHeight;
      let left = align === "right" ? a.right - w : a.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      let top = a.bottom + gap;
      if (top + h > window.innerHeight - 8 && a.top - gap - h > 8) top = a.top - gap - h;
      p.style.left = `${left}px`;
      p.style.top = `${top}px`;
      p.style.visibility = "visible";
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, align]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) close.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor]);

  return createPortal(
    <div
      ref={panel}
      {...aria}
      style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
      className={`z-[100] animate-pop rounded-3xl border border-lavender-200 bg-white p-4 shadow-[0_24px_60px_-20px_rgba(42,32,57,0.35)] ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}

export function DateField({
  name,
  defaultValue = "",
  min,
  max,
  id,
  placeholder = "Escolher data",
  align = "left",
  className = "",
  onChange,
}: {
  name: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  id?: string;
  placeholder?: string;
  align?: "left" | "right";
  className?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((defaultValue || min || todayInStudio()).slice(0, 7));
  const button = useRef<HTMLButtonElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const today = todayInStudio();

  useFormReset(hidden, () => setValue(defaultValue));

  function pick(date: string) {
    setValue(date);
    onChange?.(date);
    setOpen(false);
  }

  const dates = monthDates(month);
  const lead = weekdayOf(dates[0]);
  const disabled = (d: string) => (min != null && d < min) || (max != null && d > max);

  return (
    <>
      <input ref={hidden} type="hidden" name={name} value={value} />
      <button
        ref={button}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) setMonth((value || min || today).slice(0, 7));
          setOpen((o) => !o);
        }}
        className={`field flex items-center justify-between gap-2 text-left ${open ? "border-lavender-500 ring-4 ring-lavender-200/60" : ""} ${className}`}
      >
        <span className={`truncate ${value ? "text-plum-900" : "text-plum-600/40"}`}>{value ? `${formatDateCompact(value)} ${value.slice(0, 4)}` : placeholder}</span>
        <CalendarDays className="size-4 shrink-0 text-lavender-600" />
      </button>

      {open && (
        <FloatingPanel anchor={button} onClose={() => setOpen(false)} align={align} role="dialog" aria-label="Escolher data" className="w-[19.5rem]">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, -1))}
              disabled={!!min && month <= min.slice(0, 7)}
              className="grid size-9 place-items-center rounded-full text-plum-700 transition hover:bg-lavender-100 disabled:opacity-25"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="font-display text-xl">{formatMonth(month)}</p>
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              disabled={!!max && month >= max.slice(0, 7)}
              className="grid size-9 place-items-center rounded-full text-plum-700 transition hover:bg-lavender-100 disabled:opacity-25"
              aria-label="Próximo mês"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-7 text-center text-[0.6rem] tracking-[0.12em] text-plum-600/60 uppercase">
            {WEEKDAYS_SHORT.map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: lead }, (_, i) => (
              <span key={i} />
            ))}
            {dates.map((d) => {
              const sel = d === value;
              const off = disabled(d);
              return (
                <button
                  key={d}
                  type="button"
                  disabled={off}
                  onClick={() => pick(d)}
                  className={[
                    "mx-auto grid size-9 place-items-center rounded-full text-sm transition",
                    sel ? "bg-plum-900 font-medium text-white shadow-soft" : off ? "text-plum-600/25" : "text-plum-900 hover:bg-lavender-100",
                    d === today && !sel ? "ring-1 ring-lavender-400" : "",
                  ].join(" ")}
                >
                  {Number(d.slice(8))}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-lavender-100 pt-3">
            <button
              type="button"
              onClick={() => {
                setValue("");
                onChange?.("");
                setOpen(false);
              }}
              className="rounded-full px-3 py-1.5 text-xs tracking-wide text-plum-600/70 hover:bg-lavender-50"
            >
              Limpar
            </button>
            <button
              type="button"
              disabled={disabled(today)}
              onClick={() => pick(today)}
              className="rounded-full px-3 py-1.5 text-xs font-medium tracking-wide text-lavender-700 hover:bg-lavender-50 disabled:opacity-30"
            >
              Hoje
            </button>
          </div>
        </FloatingPanel>
      )}
    </>
  );
}

export function TimeField({
  name,
  defaultValue = "",
  step = 15,
  from = 5 * 60,
  to = 23 * 60 + 45,
  allowEmpty = false,
  placeholder = "--:--",
  ariaLabel,
  align = "left",
  className = "",
}: {
  name: string;
  defaultValue?: string;
  step?: number;
  from?: number;
  to?: number;
  allowEmpty?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  align?: "left" | "right";
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useFormReset(hidden, () => setValue(defaultValue));

  // Ao abrir, rola a lista (só ela, não a página) até o horário escolhido.
  useEffect(() => {
    if (!open) return;
    const l = list.current;
    const sel = l?.querySelector<HTMLElement>("[data-selected=true]");
    if (l && sel) l.scrollTop = sel.offsetTop - l.clientHeight / 2 + sel.offsetHeight / 2;
  }, [open]);

  const options: number[] = [];
  for (let t = from; t <= to; t += step) options.push(t);
  const current = value ? timeToMin(value) : null;
  // Mantém um horário salvo que não esteja na grade (ex.: 08:10).
  if (current != null && !options.includes(current)) {
    options.push(current);
    options.sort((a, b) => a - b);
  }

  return (
    <>
      <input ref={hidden} type="hidden" name={name} value={value} />
      <button
        ref={button}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`field flex items-center justify-between gap-2 text-left tabular-nums ${open ? "border-lavender-500 ring-4 ring-lavender-200/60" : ""} ${className}`}
      >
        <span className={value ? "text-plum-900" : "text-plum-600/40"}>{value || placeholder}</span>
        <Clock className="size-3.5 shrink-0 text-lavender-600" />
      </button>

      {open && (
        <FloatingPanel anchor={button} onClose={() => setOpen(false)} align={align} role="listbox" aria-label={ariaLabel ?? "Escolher horário"} className="w-60 p-3">
          <div ref={list} className="relative grid max-h-56 grid-cols-4 gap-1 overflow-y-auto pr-1">
            {options.map((t) => {
              const sel = t === current;
              return (
                <button
                  key={t}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  data-selected={sel}
                  onClick={() => {
                    setValue(minToTime(t));
                    setOpen(false);
                  }}
                  className={`rounded-full py-1.5 text-xs tabular-nums transition ${sel ? "bg-plum-900 text-white" : "text-plum-800 hover:bg-lavender-100"}`}
                >
                  {minToTime(t)}
                </button>
              );
            })}
          </div>
          {allowEmpty && (
            <div className="mt-2 border-t border-lavender-100 pt-2 text-right">
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  setOpen(false);
                }}
                className="rounded-full px-3 py-1 text-xs tracking-wide text-plum-600/70 hover:bg-lavender-50"
              >
                Sem horário
              </button>
            </div>
          )}
        </FloatingPanel>
      )}
    </>
  );
}

export type SelectOption = { value: string; label: string; hint?: string };

/** Lista de opções no visual do studio (substitui o <select> nativo). */
export function SelectField({
  name,
  options,
  defaultValue,
  ariaLabel,
  align = "left",
  className = "",
  panelClassName = "w-72",
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  ariaLabel?: string;
  align?: "left" | "right";
  className?: string;
  panelClassName?: string;
}) {
  const initial = defaultValue ?? options[0]?.value ?? "";
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  useFormReset(hidden, () => setValue(initial));
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <input ref={hidden} type="hidden" name={name} value={value} />
      <button
        ref={button}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`field flex items-center justify-between gap-2 text-left ${open ? "border-lavender-500 ring-4 ring-lavender-200/60" : ""} ${className}`}
      >
        <span className="min-w-0 truncate">
          {selected?.label ?? "Escolher"}
          {selected?.hint && <span className="ml-2 text-sm text-plum-600/60">{selected.hint}</span>}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-lavender-600 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <FloatingPanel anchor={button} onClose={() => setOpen(false)} align={align} role="listbox" aria-label={ariaLabel ?? "Escolher opção"} className={`p-2 ${panelClassName}`}>
          <div className="max-h-72 overflow-y-auto">
            {options.map((o) => {
              const sel = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={sel}
                  onClick={() => {
                    setValue(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition ${sel ? "bg-lavender-100 text-plum-900" : "text-plum-800 hover:bg-lavender-50"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className="block truncate text-xs text-plum-600/60">{o.hint}</span>}
                  </span>
                  {sel && <Check className="size-4 shrink-0 text-lavender-600" />}
                </button>
              );
            })}
          </div>
        </FloatingPanel>
      )}
    </>
  );
}
