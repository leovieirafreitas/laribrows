import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import type { Appointment } from "@/lib/db/schema";
import { formatBRL } from "@/lib/format";
import { formatDateCompact, minToTime } from "@/lib/time";

export function AppointmentItem({ a, showDate = false }: { a: Appointment; showDate?: boolean }) {
  const remaining = a.totalCents - a.paidCents;
  return (
    <Link
      href={`/admin/agendamentos/${a.id}`}
      className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition hover:bg-lavender-50"
    >
      <div className="w-14 shrink-0 text-center">
        {showDate && <p className="text-[0.65rem] text-plum-600/60">{formatDateCompact(a.date)}</p>}
        <p className="font-display text-xl leading-tight text-plum-900">{minToTime(a.startMin)}</p>
      </div>
      <div className="h-10 w-px bg-lavender-200" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-plum-900">{a.clientName}</p>
        <p className="truncate text-sm text-plum-600/70">
          {a.serviceName} · até {minToTime(a.endMin)}
        </p>
      </div>
      <div className="hidden text-right sm:block">
        <StatusBadge status={a.status} />
        <p className="mt-1 text-xs text-plum-600/60">
          {remaining > 0 ? `Falta ${formatBRL(remaining)}` : "Quitado"}
        </p>
      </div>
      <ChevronRight className="size-4 text-plum-600/30 transition group-hover:translate-x-0.5 group-hover:text-lavender-600" />
    </Link>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="display mt-2 text-4xl sm:text-5xl">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
