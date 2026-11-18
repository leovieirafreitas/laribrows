import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth";
import { appointments, db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Painel", template: "%s · Painel" }, robots: { index: false } };

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  // Sessão vem do token (sem banco) e as configurações ficam em memória: o layout responde rápido
  // e a página começa a carregar sem esperar o contador do menu.
  const [admin, s] = await Promise.all([requireAdmin(), getSettings()]);
  return (
    <div className="min-h-screen bg-lavender-50/60 lg:flex">
      <AdminNav
        studioName={s.studioName}
        adminName={admin.name}
        pendingBadge={
          <Suspense fallback={null}>
            <PendingBadge />
          </Suspense>
        }
      />
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}

/** Quantidade de PIX aguardando conferência (chega separado, sem segurar a página). */
async function PendingBadge() {
  const count = await db.$count(appointments, eq(appointments.status, "AWAITING_CONFIRMATION"));
  if (!count) return null;
  return <span className="grid min-w-5 place-items-center rounded-full bg-champagne-400 px-1.5 text-[0.65rem] font-medium text-plum-950">{count}</span>;
}
