/**
 * Gera o "PIX copia e cola" (BR Code / EMV) estático com valor, a partir da
 * chave PIX do studio. Não depende de gateway — o dinheiro cai direto na conta
 * e a confirmação é feita manualmente no painel.
 */

function tlv(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function clean(text: string, max: number) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

export function normalizePixKey(key: string) {
  const k = key.trim();
  if (k.includes("@")) return k.toLowerCase();
  if (k.startsWith("+")) return `+${k.replace(/\D/g, "")}`;
  // CPF/CNPJ formatados → só dígitos. Chave aleatória (UUID) fica como está.
  if (/^[\d.\-/ ]+$/.test(k)) return k.replace(/\D/g, "");
  return k;
}

export function buildPixCode(opts: {
  key: string;
  amountCents: number;
  receiverName: string;
  receiverCity: string;
  txid?: string;
  description?: string;
}) {
  const account =
    tlv("00", "br.gov.bcb.pix") +
    tlv("01", normalizePixKey(opts.key)) +
    (opts.description ? tlv("02", clean(opts.description, 40)) : "");
  const txid = (opts.txid ?? "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  const payload =
    tlv("00", "01") +
    tlv("26", account) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", (opts.amountCents / 100).toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", clean(opts.receiverName, 25) || "STUDIO") +
    tlv("60", clean(opts.receiverCity, 15) || "BRASIL") +
    tlv("62", tlv("05", txid)) +
    "6304";
  return payload + crc16(payload);
}
