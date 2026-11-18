"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { useFormStatus } from "react-dom";

export function CopyButton({ text, label = "Copiar", className = "btn btn-primary" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const el = document.createElement("textarea");
          el.value = text;
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          el.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copiado!" : label}
    </button>
  );
}

/** Envio em andamento em formulários controlados por onSubmit (ver ActionForm). */
export const FormPendingContext = createContext(false);

export function SubmitButton({ children, className = "btn btn-primary", pendingText, confirm }: { children: React.ReactNode; className?: string; pendingText?: string; confirm?: string }) {
  const status = useFormStatus();
  const ctxPending = useContext(FormPendingContext);
  const pending = status.pending || ctxPending;
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
