import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth";
import { appointments, db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Painel", template: "%s · Painel" }, robots: { index: false } };

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [s, toCheck] = await Promise.all([
    getSettings(),
    db.$count(appointments, inArray(appointments.status, ["AWAITING_CONFIRMATION"])),
  ]);
  return (
    <div className="min-h-screen bg-lavender-50/60 lg:flex">
      <AdminNav studioName={s.studioName} adminName={admin.name} pendingCount={toCheck} />
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
