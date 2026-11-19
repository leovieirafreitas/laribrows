import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { admins, db } from "@/lib/db";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from "@/lib/session";

/** Impressão curta da senha (vai no token da sessão; não permite descobrir a senha). */
const fingerprint = (passwordHash: string) => createHash("sha256").update(`sessao:${passwordHash}`).digest("base64url").slice(0, 16);

// Impressão atual de cada admin, guardada por 60s (evita ir ao banco a cada página).
const fpMemo = ((globalThis as { __lbAdminFp?: Map<string, { fp: string | null; at: number }> }).__lbAdminFp ??= new Map<string, { fp: string | null; at: number }>());

async function currentFingerprint(adminId: string) {
  const hit = fpMemo.get(adminId);
  if (hit && Date.now() - hit.at < 60_000) return hit.fp;
  const row = await db.query.admins.findFirst({ where: eq(admins.id, adminId), columns: { passwordHash: true } });
  const fp = row ? fingerprint(row.passwordHash) : null;
  fpMemo.set(adminId, { fp, at: Date.now() });
  return fp;
}

/**
 * Admin logado. O token assinado traz nome e e-mail; a sessão só vale enquanto a senha
 * for a mesma de quando o login foi feito (trocar/redefinir a senha derruba as outras sessões).
 */
export const getAdmin = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session?.fp || !session.name || !session.email) return null;
  if ((await currentFingerprint(session.adminId)) !== session.fp) return null;
  return { id: session.adminId, name: session.name, email: session.email };
});

/** Use no topo de toda página e ação do painel. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function startSession(admin: { id: string; name: string; email: string; passwordHash: string }) {
  const fp = fingerprint(admin.passwordHash);
  fpMemo.set(admin.id, { fp, at: Date.now() });
  (await cookies()).set(SESSION_COOKIE, await signSession({ id: admin.id, name: admin.name, email: admin.email, fp }), {
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
