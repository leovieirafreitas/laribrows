import "server-only";
import { siteUrl } from "@/lib/env";

/** E-mails do sistema (ex.: redefinir senha do painel) pela API do Resend. */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function sendEmail(opts: { to: string; subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) throw new Error("RESEND_API_KEY / EMAIL_FROM não configurados");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    cache: "no-store",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html, text: opts.text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend respondeu ${res.status}: ${body.slice(0, 300)}`);
  }
}

/** Logo publicada pelo próprio site (src/app/email/logo.png). Em testes locais usa a do site no ar. */
function logoUrl() {
  const base = siteUrl().startsWith("https://") ? siteUrl() : "https://laribrows.com.br";
  return `${base}/email/logo.png`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Moldura dos e-mails no visual da marca (mesma dos e-mails de acesso das clientes). */
export function brandEmail(opts: { title: string; text: string; button: { label: string; url: string }; footer: string }) {
  return `<!doctype html><html><body style="margin:0;background:#faf7fd;font-family:Helvetica,Arial,sans-serif;color:#2a2039">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border:1px solid #e9dff5;border-radius:24px;padding:40px 32px">
<tr><td align="center">
<img src="${logoUrl()}" width="300" height="113" alt="Lari Brows · studio de sobrancelhas" style="display:block;margin:0 auto 24px;border:0;outline:none;width:300px;max-width:100%;height:auto;font-family:Georgia,serif;font-size:22px;color:#2a2039">
<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px">${esc(opts.title)}</p>
<p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#5a4672">${esc(opts.text)}</p>
<a href="${esc(opts.button.url)}" style="display:inline-block;background:#2a2039;color:#ffffff;text-decoration:none;font-size:12px;letter-spacing:3px;text-transform:uppercase;padding:14px 28px;border-radius:999px">${esc(opts.button.label)}</a>
<p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#8a7a9e">${esc(opts.footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
}
