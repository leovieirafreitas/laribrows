import { roundLogoImage } from "@/lib/email-logo";

/** https://laribrows.com.br/logo-perfil.png — monograma para foto de perfil (Gmail, WhatsApp, Instagram). */
export const dynamic = "force-static";

export function GET() {
  return roundLogoImage("perfil", 1024, { squareBackground: true });
}
