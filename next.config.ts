import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança em todas as respostas.
 * CSP: só carrega scripts, estilos, fontes e conexões do próprio site; imagens também de data:/blob:
 * (QR Code) e da foto de perfil do WhatsApp no painel; o site não pode ser embutido em outros (clickjacking).
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://pps.whatsapp.net",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // Em desenvolvimento o Next usa eval/websocket; a CSP vale só no site publicado.
    if (process.env.NODE_ENV !== "production") return [];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Servidor enxuto para Docker (EasyPanel): .next/standalone/server.js
  output: "standalone",
  // App 100% dinâmico (agenda, pagamentos, painel): usamos o modelo de
  // renderização dinâmica clássico em vez de Cache Components.
  cacheComponents: false,
  // Postgres embutido (dev local) não deve ser empacotado pelo bundler.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  experimental: {
    // Páginas já visitadas ficam guardadas no navegador por 30s (voltar a elas é instantâneo);
    // páginas pré-carregadas pelo menu valem por 60s. Salvar algo no painel limpa esse cache.
    staleTimes: { dynamic: 30, static: 60 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
