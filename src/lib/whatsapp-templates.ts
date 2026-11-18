/** Modelos das mensagens de WhatsApp (usados no servidor e na prévia do painel). */

export const TEMPLATE_VARS = [
  ["{nome}", "primeiro nome da cliente"],
  ["{procedimento}", "procedimento"],
  ["{data}", "ex.: Quinta-feira, 20 de novembro"],
  ["{hora}", "ex.: 10:00"],
  ["{quando}", "“hoje” ou “amanhã” (lembrete)"],
  ["{endereco}", "endereço do studio"],
  ["{valor_pago}", "quanto já pagou"],
  ["{restante}", "quanto falta pagar"],
  ["{codigo}", "código do agendamento"],
  ["{link}", "página do agendamento"],
  ["{studio}", "nome do studio"],
] as const;

export const DEFAULT_CONFIRM_TEMPLATE = `Oi, {nome}! 💜 Seu horário no {studio} está confirmado.

✨ {procedimento}
📅 {data} às {hora} (horário de Manaus)
📍 {endereco}

💳 Pago: {valor_pago} · Restante no dia: {restante}
🔗 Detalhes: {link}

Qualquer dúvida, é só responder esta mensagem.`;

export const DEFAULT_REMINDER_TEMPLATE = `Oi, {nome}! Passando para lembrar do seu horário {quando} 💜

✨ {procedimento}
📅 {data} às {hora} (horário de Manaus)
📍 {endereco}

Se precisar remarcar, é só responder esta mensagem. Até lá!`;

export type Vars = Record<string, string>;

/** Troca as {variáveis}; linhas cuja variável ficou vazia (ex.: sem endereço) somem. */
export function renderTemplate(template: string, vars: Vars) {
  return template
    .split("\n")
    .flatMap((line) => {
      const used = [...line.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]);
      if (used.some((k) => k in vars && !vars[k])) return [];
      return [line.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Dados de exemplo para a prévia no painel. */
export const SAMPLE_VARS: Vars = {
  nome: "Maria",
  nome_completo: "Maria Silva",
  procedimento: "Design de Sobrancelhas",
  data: "Quinta-feira, 20 de novembro",
  hora: "10:00",
  quando: "amanhã",
  endereco: "",
  valor_pago: "R$ 30,00",
  restante: "R$ 30,00",
  codigo: "LB7K2Q9X",
  link: "https://laribrows.com.br/agendamento/…",
  studio: "Lari Brows",
};
