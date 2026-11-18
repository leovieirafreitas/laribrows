import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { cleanupExpired } from "@/lib/availability";
import { appointments, db, payments } from "@/lib/db";
import { addDays, addMonths, nowInStudio, studioToDate } from "@/lib/time";

const ACTIVE = ["CONFIRMED", "AWAITING_CONFIRMATION", "PENDING_PAYMENT", "COMPLETED", "NO_SHOW"] as const;

export async function getDashboardData() {
  await cleanupExpired();
  const now = nowInStudio();
  const today = now.date;
  const month = today.slice(0, 7);
  const firstMonth = addMonths(month, -5);
  const weekEnd = addDays(today, 6);

  const [todayList, upcoming, awaiting, approved, monthAppts] = await Promise.all([
    db
      .select()
      .from(appointments)
      .where(and(eq(appointments.date, today), inArray(appointments.status, [...ACTIVE])))
      .orderBy(asc(appointments.startMin)),
    db
      .select()
      .from(appointments)
      .where(
        and(
          gte(appointments.date, today),
          lte(appointments.date, addDays(today, 60)),
          inArray(appointments.status, ["CONFIRMED", "AWAITING_CONFIRMATION", "PENDING_PAYMENT"]),
        ),
      )
      .orderBy(asc(appointments.date), asc(appointments.startMin)),
    db
      .select()
      .from(appointments)
      .where(eq(appointments.status, "AWAITING_CONFIRMATION"))
      .orderBy(asc(appointments.date), asc(appointments.startMin)),
    db
      .select({ amountCents: payments.amountCents, paidAt: payments.paidAt })
      .from(payments)
      .where(and(eq(payments.status, "APPROVED"), gte(payments.paidAt, studioToDate(`${firstMonth}-01`, 0)))),
    db
      .select({ serviceName: appointments.serviceName, status: appointments.status })
      .from(appointments)
      .where(and(gte(appointments.date, `${month}-01`), lte(appointments.date, `${month}-31`))),
  ]);

  // Faturamento recebido por mês (fuso do studio)
  const months = Array.from({ length: 6 }, (_, i) => addMonths(firstMonth, i));
  const revenue = new Map(months.map((m) => [m, 0]));
  for (const p of approved) {
    if (!p.paidAt) continue;
    const m = nowInStudio(p.paidAt).date.slice(0, 7);
    if (revenue.has(m)) revenue.set(m, revenue.get(m)! + p.amountCents);
  }

  const future = upcoming.filter((a) => a.date > today || (a.date === today && a.endMin > now.minutes));
  const confirmedFuture = future.filter((a) => a.status === "CONFIRMED");
  const toReceive = confirmedFuture.reduce((sum, a) => sum + Math.max(0, a.totalCents - a.paidCents), 0);

  const counts = new Map<string, number>();
  for (const a of monthAppts) {
    if (a.status === "CANCELLED" || a.status === "EXPIRED") continue;
    counts.set(a.serviceName, (counts.get(a.serviceName) ?? 0) + 1);
  }
  const topServices = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const finished = monthAppts.filter((a) => a.status === "COMPLETED" || a.status === "NO_SHOW");
  const showRate = finished.length ? Math.round((finished.filter((a) => a.status === "COMPLETED").length / finished.length) * 100) : null;

  return {
    today,
    nowMinutes: now.minutes,
    todayList,
    next: future.filter((a) => a.date > today).slice(0, 6),
    weekCount: future.filter((a) => a.date <= weekEnd && a.status !== "PENDING_PAYMENT").length,
    awaiting,
    pendingPaymentCount: future.filter((a) => a.status === "PENDING_PAYMENT").length,
    monthRevenue: revenue.get(month) ?? 0,
    revenueSeries: months.map((m) => ({ month: m, cents: revenue.get(m) ?? 0 })),
    toReceive,
    topServices,
    showRate,
  };
}
