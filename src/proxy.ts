import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { refreshClientSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Painel: checagem otimista da sessão do admin.
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/login")) return NextResponse.next();
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) return NextResponse.redirect(new URL("/admin/login", request.url));
    return NextResponse.next();
  }

  // Site: mantém a sessão da cliente (área da cliente) sempre válida.
  return refreshClientSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
