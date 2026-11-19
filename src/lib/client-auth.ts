import "server-only";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { appointments, clientProfiles, db } from "@/lib/db";
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

/** Cadastro completo: nome e sobrenome + WhatsApp com DDD. */
export function profileComplete(p: { name: string; phone: string }) {
  return p.name.trim().split(/\s+/).filter(Boolean).length >= 2 && p.phone.replace(/\D/g, "").length >= 10;
}

/** Cadastro salvo pelo sistema (fonte da verdade; o perfil do Supabase Auth é só uma cópia). */
export async function storedProfile(email: string) {
  return db.query.clientProfiles.findFirst({ where: eq(clientProfiles.email, email.toLowerCase()) });
}

export async function saveStoredProfile(email: string, name: string, phone: string) {
  await db
    .insert(clientProfiles)
    .values({ email: email.toLowerCase(), name, phone })
    .onConflictDoUpdate({ target: clientProfiles.email, set: { name, phone, updatedAt: new Date() } });
}

/** Cliente com nome e WhatsApp do cadastro (tabela do sistema ou, sem ela, o perfil da conta). */
async function withProfile(user: ClientUser): Promise<ClientUser> {
  const stored = await storedProfile(user.email);
  return stored ? { ...user, name: stored.name, phone: stored.phone } : user;
}

/** Cliente logada e com cadastro completo; no primeiro acesso, manda completar o cadastro e depois volta para `next`. */
export async function requireCompleteClient(next: string) {
  const user = await withProfile(await requireClientUser());
  if (!profileComplete(user)) redirect(`/minha-conta/completar?next=${encodeURIComponent(next)}`);
  return user;
}

/** Já completou o cadastro? (para a tela de primeiro acesso) */
export async function hasCompleteProfile(user: ClientUser) {
  return profileComplete(await withProfile(user));
}

/** Nome/telefone para preencher formulários: perfil ou último agendamento com o mesmo e-mail. */
export async function clientProfile(user: ClientUser) {
  const stored = await storedProfile(user.email);
  if (stored) return { name: stored.name, phone: stored.phone };
  if (user.name && user.phone) return { name: user.name, phone: user.phone };
  const last = await db.query.appointments.findFirst({
    where: eq(appointments.clientEmail, user.email),
    orderBy: desc(appointments.createdAt),
    columns: { clientName: true, clientPhone: true },
  });
  return { name: user.name || last?.clientName || "", phone: user.phone || last?.clientPhone || "" };
}
