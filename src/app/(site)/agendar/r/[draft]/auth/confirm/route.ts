import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { clientFromAuthUser, finishDraft, getDraft, type BookingResult } from "@/lib/booking-client";
import { siteUrl } from "@/lib/env";
import { createSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Botão do e-mail enviado no agendamento: confirma o e-mail e já grava o agendamento e
 * segue para o pagamento (o pedido fica guardado no servidor, ver booking-client.ts).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ draft: string }> }) {
  const { draft: draftId } = await params;
  const sp = request.nextUrl.searchParams;
  const tokenHash = sp.get("token_hash");
  const type = (sp.get("type") ?? "email") as EmailOtpType;
  const draft = getDraft(draftId);

  const go = (path: string) => NextResponse.redirect(new URL(path, siteUrl()));
  const finish = (r: BookingResult) =>
    r.ok
      ? NextResponse.redirect(r.external ? r.redirectTo : new URL(r.redirectTo, siteUrl()))
      : go(`/agendar?aviso=${/horário/i.test(r.error) ? "horario" : "erro"}`);

  // Já concluído (código digitado no site ou link aberto de novo): mesmo resultado, sem outro agendamento.
  if (draft?.result) return finish(await draft.result);

  if (!tokenHash) return go("/entrar?erro=link");
  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) return go("/entrar?erro=link");

  const client = clientFromAuthUser(data.user);
  // Pedido vencido (mais de 1 hora) ou servidor reiniciado: o e-mail está confirmado, falta escolher de novo.
  if (!draft || draft.email !== client.email) return go("/agendar?aviso=refazer");
  return finish(await finishDraft(draft, client, supabase));
}
