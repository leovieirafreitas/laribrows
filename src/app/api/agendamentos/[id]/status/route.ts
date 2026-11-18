import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isHoldExpired, refreshPendingPayment } from "@/lib/booking";
import { appointments, db, payments } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Consultado pela tela do PIX a cada poucos segundos. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pending = await db.query.payments.findFirst({
    where: and(eq(payments.appointmentId, id), eq(payments.status, "PENDING")),
    orderBy: desc(payments.createdAt),
  });
  if (pending) await refreshPendingPayment(pending);

  const appt = await db.query.appointments.findFirst({
    where: eq(appointments.id, id),
    columns: { status: true, expiresAt: true },
  });
  if (!appt) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ status: isHoldExpired(appt) ? "EXPIRED" : appt.status });
}
