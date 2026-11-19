import { nationalPhone } from "@/lib/format";

/**
 * Texto embaixo do campo de WhatsApp: exemplo com o DDD 92 e, se o DDD digitado não for do
 * Amazonas (92/97), um aviso para conferir — pega o "55" do Brasil digitado no lugar do DDD.
 */
export function PhoneHint({ phone, extra }: { phone: string; extra?: string }) {
  const d = nationalPhone(phone);
  const ddd = d.length >= 2 ? d.slice(0, 2) : "";
  const warn =
    ddd === "55"
      ? "Não coloque o 55 do Brasil: comece pelo DDD. Em Manaus é 92, por exemplo (92) 99999-9999."
      : ddd && ddd !== "92" && ddd !== "97"
        ? `DDD ${ddd}? Confira: em Manaus o DDD é 92, por exemplo (92) 99999-9999.`
        : null;

  if (warn) {
    return (
      <p role="status" className="mt-2 rounded-xl border border-champagne-300 bg-champagne-200/50 px-3 py-2 text-xs text-champagne-600">
        {warn}
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs text-plum-600/60">
      Com DDD, por exemplo (92) 99999-9999.{extra ? ` ${extra}` : ""}
    </p>
  );
}
