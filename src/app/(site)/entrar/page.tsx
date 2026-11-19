import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginFlow } from "./LoginFlow";
import { Ornament } from "@/components/brand/Ornament";
import { getClientUser } from "@/lib/client-auth";
import { turnstileSiteKey } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar · Área da cliente", robots: { index: false } };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await getClientUser()) redirect("/minha-conta");
  const { erro } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-5 py-14 sm:py-20">
      <div className="text-center">
        <p className="eyebrow">Área da cliente</p>
        <h1 className="display mt-3 text-5xl">
          Bem-vinda <em className="text-lavender-600">de volta</em>
        </h1>
        <p className="mt-3 text-plum-700/80">Veja seus horários, remarque e acompanhe pagamentos — sem senha para lembrar.</p>
        <Ornament className="mx-auto mt-6 text-champagne-500" />
      </div>
      <div className="card mt-8 p-6 sm:p-8">
        {erro === "link" && (
          <p className="mb-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">O link expirou ou já foi usado. Peça um novo código abaixo.</p>
        )}
        <LoginFlow turnstileSiteKey={turnstileSiteKey()} />
      </div>
    </div>
  );
}
