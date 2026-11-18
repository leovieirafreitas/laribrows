import { jwtVerify, SignJWT } from "jose";

/** Sessão do painel: JWT assinado em cookie httpOnly. Usado também no proxy. */
export const SESSION_COOKIE = "lb_session";
export const SESSION_DAYS = 7;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("Defina SESSION_SECRET (mín. 16 caracteres) no .env");
  return new TextEncoder().encode(secret);
}

export type AdminSession = { adminId: string; name?: string; email?: string };

export async function signSession(admin: { id: string; name: string; email: string }) {
  return new SignJWT({ sub: admin.id, name: admin.name, email: admin.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export async function verifySession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    const session: AdminSession = { adminId: payload.sub };
    if (typeof payload.name === "string") session.name = payload.name;
    if (typeof payload.email === "string") session.email = payload.email;
    return session;
  } catch {
    return null;
  }
}
