/** Regras de valor compartilhadas entre o servidor e a tela de agendamento (sem dependências de servidor). */

/** Menor valor aceito no pagamento online (a InfinitePay recusa abaixo de R$ 1,00). */
export const MIN_ONLINE_CENTS = 100;

/** Sinal: a porcentagem do procedimento, nunca abaixo do mínimo online (nem acima do valor total). */
export function depositCents(totalCents: number, percent: number) {
  const pct = Math.min(100, Math.max(1, percent));
  const value = Math.round((totalCents * pct) / 100);
  return Math.min(totalCents, Math.max(value, MIN_ONLINE_CENTS));
}
