import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/env";
import { createSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Link do e-mail de acesso: confirma o token e abre a área da cliente (funciona em outro aparelho). */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const tokenHash = sp.get("token_hash");
  const type = (sp.get("type") ?? "email") as EmailOtpType;
  // Só caminhos internos (evita redirecionar para outro site com "//dominio").
  const raw = sp.get("next") ?? "";
  const next = /^\/(?![/\\])/.test(raw) ? raw : "/minha-conta";

  const code = sp.get("code");
  const supabase = await createSupabase();

  // Modelo de e-mail próprio (supabase/email): link com token_hash — funciona em qualquer aparelho.
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, siteUrl()));
  }
  // E-mail padrão do Supabase: volta com ?code= (precisa ser aberto no mesmo navegador).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, siteUrl()));
  }
  return NextResponse.redirect(new URL("/entrar?erro=link", siteUrl()));
}
