import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";

/**
 * Produção / Supabase: DATABASE_URL = postgresql://... (pooler do Supabase, modo transação, porta 6543).
 * Sem DATABASE_URL: Postgres embutido (PGlite) em ./data/pglite, só para desenvolvimento.
 *
 * Driver: node-postgres (`pg`). Ele envia cada consulta numa única viagem ao banco e funciona
 * bem com o pooler do Supabase. (O `postgres.js` usado antes fazia 2 viagens por consulta e,
 * com o pooler, às vezes deixava conexões presas — travando o servidor.)
 */
type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __lbDb?: DB };

/** Sinais de conexão perdida/derrubada (rede ou pooler). */
function isConnectionError(err: unknown) {
  const e = err as { code?: string; message?: string };
  return (
    ["ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED", "57P01"].includes(e.code ?? "") ||
    /Connection terminated|Query read timeout|Connection ended/i.test(e.message ?? "")
  );
}

/**
 * Se uma conexão tiver caído, repete a consulta uma vez numa conexão nova.
 * Só para leituras (SELECT): repetir uma gravação poderia duplicar dados.
 * Transações não passam por aqui (usam um cliente dedicado do pool).
 */
function withReadRetry(pool: Pool): Pool {
  return new Proxy(pool, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (prop !== "query") return typeof value === "function" ? value.bind(target) : value;
      return async (...args: unknown[]) => {
        const first = args[0] as string | { text?: string };
        const text = typeof first === "string" ? first : (first?.text ?? "");
        const run = () => (target.query as (...a: unknown[]) => Promise<unknown>)(...args);
        try {
          return await run();
        } catch (err) {
          if (/^\s*(select|with)\b/i.test(text) && isConnectionError(err)) return await run();
          throw err;
        }
      };
    },
  });
}

function createDb(): DB {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (/^postgres(ql)?:\/\//.test(url)) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    const config: PoolConfig = {
      connectionString: url,
      // Conexão criptografada (o pooler do Supabase usa certificado próprio).
      ssl: local ? false : { rejectUnauthorized: false },
      // Páginas fazem várias consultas em paralelo.
      max: process.env.VERCEL ? 5 : 8,
      // Abrir conexão com o Supabase é caro (~1,5s do Brasil): mantém abertas por alguns minutos.
      idleTimeoutMillis: 180_000,
      maxLifetimeSeconds: 30 * 60,
      connectionTimeoutMillis: 15_000,
      keepAlive: true,
      // Nenhuma consulta pode ficar pendurada para sempre: desiste após 20s (e leituras tentam de novo).
      query_timeout: 20_000,
    };
    const pool = new Pool(config);
    // Conexão que cai enquanto está parada no pool não pode derrubar o servidor.
    pool.on("error", (err) => console.error("[db] conexão do pool caiu:", err.message));
    return drizzleNodePg(withReadRetry(pool), { schema });
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
