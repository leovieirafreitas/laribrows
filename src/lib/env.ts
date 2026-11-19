/**
 * Variáveis lidas na hora em que o servidor roda (não na montagem do site).
 * O Next.js grava `process.env.NEXT_PUBLIC_*` no código durante o build; lendo pelo nome,
 * o mesmo build funciona em qualquer servidor (EasyPanel, Vercel...) com as variáveis de lá.
 * Use só no servidor.
 */
function runtimeEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

/** Endereço público do site, sem barra no final. */
export function siteUrl() {
  return (runtimeEnv("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000").replace(/\/$/, "");
}

/** Chave pública do Cloudflare Turnstile (CAPTCHA do login da cliente). Vazia = sem CAPTCHA. */
export function turnstileSiteKey() {
  return runtimeEnv("TURNSTILE_SITE_KEY");
}

export function supabaseEnv() {
  return { url: runtimeEnv("NEXT_PUBLIC_SUPABASE_URL"), key: runtimeEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") };
}
