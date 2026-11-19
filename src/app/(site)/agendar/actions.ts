"use server";

import { z } from "zod";
import { BookingError, createBooking } from "@/lib/booking";
import { getClientUser, saveStoredProfile, storedProfile } from "@/lib/client-auth";
import { createSupabase } from "@/lib/supabase/server";
import { onlyDigits } from "@/lib/format";
import { clientIp, MINUTE, tooMany } from "@/lib/rate-limit";
import { isValidDate } from "@/lib/time";

const schema = z.object({
  serviceId: z.string().min(1),
  date: z.string().refine(isValidDate, "Data inválida"),
  startMin: z.number().int().min(0).max(24 * 60),
  clientName: z.string().trim().min(3, "Informe seu nome completo").max(80),
  clientPhone: z
    .string()
    .trim()
    .refine((v) => onlyDigits(v).length >= 10 && onlyDigits(v).length <= 13, "WhatsApp inválido"),
  clientEmail: z.email("E-mail inválido").max(120),
  notes: z.string().max(500).default(""),
  method: z.enum(["PIX", "CARD"]).nullable(),
  payOption: z.enum(["DEPOSIT", "FULL"]),
  accepted: z.literal(true, "Aceite a política de agendamento para continuar"),
});

export type BookingResult = { ok: true; redirectTo: string; external: boolean } | { ok: false; error: string };

export async function createBookingAction(input: z.input<typeof schema>): Promise<BookingResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  // Robôs segurando horários: no máximo 6 reservas por IP a cada 10 minutos.
  if (tooMany(`booking:ip:${await clientIp()}`, 6, 10 * MINUTE)) {
    return { ok: false, error: "Muitas reservas seguidas. Aguarde alguns minutos ou fale com o studio pelo WhatsApp." };
  }
  const client = await getClientUser();
  if (client) {
    parsed.data.clientEmail = client.email;
    if (!(await storedProfile(client.email))) {
      await saveStoredProfile(client.email, parsed.data.clientName.trim(), parsed.data.clientPhone.trim()).catch(() => {});
    }
    if (!client.name || !client.phone) {
      const supabase = await createSupabase();
      const { error } = await supabase.auth
        .updateUser({ data: { name: client.name || parsed.data.clientName, phone: client.phone || parsed.data.clientPhone } })
        .catch(() => ({ error: true }));
      if (!error) await supabase.auth.refreshSession().catch(() => {});
    }
  }
  try {
    const { redirectTo } = await createBooking(parsed.data);
    return { ok: true, redirectTo, external: /^https?:\/\//.test(redirectTo) };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, error: err.message };
    console.error("[agendar]", err);
    return { ok: false, error: "Algo deu errado ao agendar. Tente novamente." };
  }
}
