import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Produção / Supabase: DATABASE_URL = postgresql://... (pooler do Supabase, porta 6543).
 * Sem DATABASE_URL: Postgres embutido (PGlite) em ./data/pglite, só para desenvolvimento.
 */
type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __lbDb?: DB };

function createDb(): DB {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (/^postgres(ql)?:\/\//.test(url)) {
    const client = postgres(url, {
      prepare: false, // obrigatório no pooler em modo transação (Supavisor)
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require",
      max: process.env.VERCEL ? 1 : 5,
      // O pooler do Supabase derruba conexões paradas; fechamos antes para nunca reutilizar uma conexão morta.
      idle_timeout: 20,
      max_lifetime: 60 * 5,
      connect_timeout: 10,
    });
    return drizzlePostgres(client, { schema });
  }
  // Mesma API do Drizzle; o PGlite roda o Postgres dentro do próprio Node.
  return drizzlePglite(new PGlite(process.env.PGLITE_DIR || "./data/pglite"), { schema }) as unknown as DB;
}

/** Conexão aberta só na primeira consulta (o build importa os módulos sem precisar do banco). */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = (globalForDb.__lbDb ??= createDb());
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export * from "./schema";
