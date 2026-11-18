import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* sem .env.local: usa variáveis do ambiente */
}

const url = process.env.DATABASE_URL?.trim() ?? "";
const remote = /^postgres(ql)?:\/\//.test(url);

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(remote
    ? // Para comandos do drizzle-kit no Supabase, prefira a conexão direta/sessão (porta 5432).
      { dbCredentials: { url: process.env.DATABASE_URL_DIRECT || url } }
    : { driver: "pglite", dbCredentials: { url: process.env.PGLITE_DIR || "./data/pglite" } }),
});
