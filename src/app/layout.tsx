import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/env";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  // Endereço público: usado para montar os links da imagem de compartilhamento.
  metadataBase: new URL(siteUrl()),
  openGraph: { type: "website", locale: "pt_BR", siteName: "Lari Brows" },
  title: {
    default: "Lari Brows · Studio de Sobrancelhas",
    template: "%s · Lari Brows",
  },
  description: "Design de sobrancelhas, henna, brow lamination e micropigmentação. Agende online.",
};

export const viewport: Viewport = {
  themeColor: "#fdfbf8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${jost.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
