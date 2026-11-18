import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
