import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { admins, db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from "@/lib/session";

export async function getAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const admin = await db.query.admins.findFirst({ where: eq(admins.id, session.adminId) });
  return admin ? { id: admin.id, name: admin.name, email: admin.email } : null;
}

/** Use no topo de toda página e ação do painel. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function startSession(adminId: string) {
  (await cookies()).set(SESSION_COOKIE, await signSession(adminId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
