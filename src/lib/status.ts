import type { AppointmentStatus, PaymentMethod, PaymentStatus } from "@/lib/db/schema";

export const STATUS_META: Record<AppointmentStatus, { label: string; className: string }> = {
  PENDING_PAYMENT: { label: "Aguardando pagamento", className: "bg-champagne-200 text-champagne-600 ring-champagne-300" },
  AWAITING_CONFIRMATION: { label: "Conferir PIX", className: "bg-lavender-200 text-lavender-700 ring-lavender-300" },
  CONFIRMED: { label: "Confirmado", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  COMPLETED: { label: "Concluído", className: "bg-plum-900 text-white ring-plum-900" },
  CANCELLED: { label: "Cancelado", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  NO_SHOW: { label: "Não compareceu", className: "bg-stone-100 text-stone-600 ring-stone-200" },
  EXPIRED: { label: "Expirado", className: "bg-stone-100 text-stone-500 ring-stone-200" },
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  PIX: "PIX",
  CARD: "Cartão de crédito",
  CASH: "Dinheiro",
  OTHER: "Outro",
};

export const PROVIDER_LABEL: Record<string, string> = {
  mercadopago: "Mercado Pago",
  pix_manual: "PIX direto",
  simulated: "Simulação",
  studio: "No studio",
};
