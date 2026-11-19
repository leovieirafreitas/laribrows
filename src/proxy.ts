import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/env";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { refreshClientSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Endereço único: quem chega pelo "www" vai para o endereço oficial (NEXT_PUBLIC_SITE_URL).
  // Evita sessões separadas (logar duas vezes) entre laribrows.com.br e www.laribrows.com.br.
  const official = new URL(siteUrl());
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host === `www.${official.host}`) return NextResponse.redirect(new URL(pathname + search, official), 308);

  // Painel: checagem otimista da sessão do admin.
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/login")) return NextResponse.next();
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) return NextResponse.redirect(new URL("/admin/login", siteUrl()));
    return NextResponse.next();
  }

  // Site: mantém a sessão da cliente (área da cliente) sempre válida.
  return refreshClientSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
