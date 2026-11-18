import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App 100% dinâmico (agenda, pagamentos, painel): usamos o modelo de
  // renderização dinâmica clássico em vez de Cache Components.
  cacheComponents: false,
  // Postgres embutido (dev local) não deve ser empacotado pelo bundler.
  serverExternalPackages: ["@electric-sql/pglite"],
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
