import { jwtVerify, SignJWT } from "jose";

/** Sessão do painel: JWT assinado em cookie httpOnly. Usado também no proxy. */
export const SESSION_COOKIE = "lb_session";
export const SESSION_DAYS = 7;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("Defina SESSION_SECRET (mín. 16 caracteres) no .env");
  return new TextEncoder().encode(secret);
}

export async function signSession(adminId: string) {
  return new SignJWT({ sub: adminId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export async function verifySession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? { adminId: payload.sub } : null;
  } catch {
    return null;
  }
}
