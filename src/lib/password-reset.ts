import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { admins, db, type Admin } from "@/lib/db";

/**
 * Link de "esqueci minha senha" do painel: token assinado, válido por 30 minutos e de uso único
 * (carrega uma impressão da senha atual — depois que a senha muda, o link deixa de valer).
 * Usa uma chave derivada, diferente da chave da sessão: o token não serve como login.
 */
export const RESET_MINUTES = 30;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("Defina SESSION_SECRET (mín. 16 caracteres) no .env");
  return new TextEncoder().encode(`${secret}:redefinir-senha`);
}

const fingerprint = (passwordHash: string) => createHash("sha256").update(passwordHash).digest("base64url").slice(0, 22);

export function createResetToken(admin: Pick<Admin, "id" | "passwordHash">) {
  return new SignJWT({ sub: admin.id, fp: fingerprint(admin.passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${RESET_MINUTES}m`)
    .sign(key());
}

/** Admin dono do link, ou null se o link for inválido, expirado ou já usado. */
export async function adminFromResetToken(token: string | undefined | null) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.fp !== "string") return null;
    const admin = await db.query.admins.findFirst({ where: eq(admins.id, payload.sub) });
    if (!admin || fingerprint(admin.passwordHash) !== payload.fp) return null;
    return admin;
  } catch {
    return null;
  }
}
