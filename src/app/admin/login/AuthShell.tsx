import { Logo } from "@/components/brand/Logo";
import { Ornament } from "@/components/brand/Ornament";

/** Moldura das telas de acesso ao painel (entrar, esqueci a senha, nova senha). */
export function AuthShell({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="bg-aura grid min-h-screen place-items-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo subtitle="painel" />
          <Ornament className="mt-6 text-champagne-500" />
        </div>
        <div className="card mt-8 p-7">
          <h1 className="display text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-plum-600/70">{text}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
