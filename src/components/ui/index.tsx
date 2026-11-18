import type { AppointmentStatus } from "@/lib/db/schema";
import { STATUS_META } from "@/lib/status";

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-medium tracking-wide whitespace-nowrap ring-1 ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export function SectionTitle({ eyebrow, title, children, center }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="display mt-3 text-4xl sm:text-5xl">{title}</h2>
      {children && <p className="mt-4 leading-relaxed text-plum-700/80">{children}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "success"; children: React.ReactNode }) {
  const tones = {
    info: "border-lavender-200 bg-lavender-50 text-plum-800",
    warn: "border-champagne-300 bg-champagne-200/50 text-champagne-600",
    error: "border-rose-200 bg-rose-50 text-rose-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  } as const;
  return <div className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}>{children}</div>;
}
