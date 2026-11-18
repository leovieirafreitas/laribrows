"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Consulta o status a cada 5s e atualiza a página quando o pagamento cair. */
export function PaymentPoller({ appointmentId, current }: { appointmentId: string; current: string }) {
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/agendamentos/${appointmentId}/status`, { cache: "no-store" });
        const data = (await r.json()) as { status?: string };
        if (alive && data.status && data.status !== current) router.refresh();
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    };
    const t = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [appointmentId, current, router]);
  return null;
}

export function Countdown({ until }: { until: number }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, until - now);
  useEffect(() => {
    if (left === 0) router.refresh();
  }, [left, router]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className="font-medium tabular-nums" suppressHydrationWarning>
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}
