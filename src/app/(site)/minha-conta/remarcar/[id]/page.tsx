import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { RescheduleFlow } from "./RescheduleFlow";
import { requireCompleteClient } from "@/lib/client-auth";
import { changePolicy } from "@/lib/client-booking";
import { appointments, db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateLong, minToTime, todayInStudio } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Remarcar horário", robots: { index: false } };

export default async function RemarcarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCompleteClient(`/minha-conta/remarcar/${id}`);
  const a = await db.query.appointments.findFirst({ where: and(eq(appointments.id, id), eq(appointments.clientEmail, user.email)) });
  if (!a) notFound();
  const s = await getSettings();
  const policy = changePolicy(a, s);

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <Link href="/minha-conta" className="inline-flex items-center gap-1.5 text-xs tracking-wide text-plum-600/70 hover:text-plum-900">
        <ArrowLeft className="size-3.5" /> Minha conta
      </Link>
      <p className="eyebrow mt-6">Remarcar</p>
      <h1 className="display mt-3 text-5xl">
        {a.serviceName}
      </h1>
      <p className="mt-2 text-plum-700/80">
        Horário atual: {formatDateLong(a.date)}, às {minToTime(a.startMin)}
      </p>

      {policy.canReschedule ? (
        <RescheduleFlow appointmentId={a.id} serviceId={a.serviceId} today={todayInStudio()} />
      ) : (
        <p className="card mt-8 p-6 text-plum-700">
          Este horário não pode mais ser remarcado por aqui (limite de {s.clientChangeHours}h antes). Fale com o studio pelo WhatsApp.
        </p>
      )}
    </div>
  );
}
