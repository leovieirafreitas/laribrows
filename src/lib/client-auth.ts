import "server-only";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { appointments, db } from "@/lib/db";
import { createSupabase, supabaseConfigured } from "@/lib/supabase/server";

export type ClientUser = { id: string; email: string; name: string; phone: string };

/** Cliente logada (sessão do Supabase Auth, JWT verificado) ou null. */
export async function getClientUser(): Promise<ClientUser | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await createSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || typeof claims.email !== "string" || !claims.email) return null;
  const meta = (claims.user_metadata ?? {}) as { name?: string; phone?: string };
  return { id: claims.sub, email: claims.email.toLowerCase(), name: meta.name ?? "", phone: meta.phone ?? "" };
}

export async function requireClientUser() {
  const user = await getClientUser();
  if (!user) redirect("/entrar");
  return user;
}

/** Nome/telefone para preencher formulários: perfil ou último agendamento com o mesmo e-mail. */
export async function clientProfile(user: ClientUser) {
  if (user.name && user.phone) return { name: user.name, phone: user.phone };
  const last = await db.query.appointments.findFirst({
    where: eq(appointments.clientEmail, user.email),
    orderBy: desc(appointments.createdAt),
    columns: { clientName: true, clientPhone: true },
  });
  return { name: user.name || last?.clientName || "", phone: user.phone || last?.clientPhone || "" };
}
