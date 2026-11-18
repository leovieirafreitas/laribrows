"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/app/admin/actions";
import { FormPendingContext } from "@/components/ui/client";

/**
 * Formulário que mostra "Salvo ✓" ou o erro devolvido pela ação do servidor.
 * Envia via onSubmit para que o React não limpe os campos (assim, em caso de
 * erro, o que foi digitado continua lá).
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <FormPendingContext value={pending}>
      <form
        ref={ref}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => formAction(fd));
        }}
      >
        {children}
        {state && !pending && (
          <p className={`mt-3 flex animate-fade-up items-center gap-2 text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`} role="status">
            {state.ok ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
            {state.message}
          </p>
        )}
      </form>
    </FormPendingContext>
  );
}
