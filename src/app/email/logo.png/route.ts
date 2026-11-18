import { wordmarkLogoImage } from "@/lib/email-logo";

/** https://laribrows.com.br/email/logo.png — logo em linha do topo dos e-mails (exibida em 300px). Gerada no build. */
export const dynamic = "force-static";

export function GET() {
  return wordmarkLogoImage();
}
