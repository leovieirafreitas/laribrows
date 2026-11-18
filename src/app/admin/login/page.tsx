import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/brand/Logo";
import { Ornament } from "@/components/brand/Ornament";
import { getAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false } };

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <div className="bg-aura grid min-h-screen place-items-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo subtitle="painel" />
          <Ornament className="mt-6 text-champagne-500" />
        </div>
        <div className="card mt-8 p-7">
          <h1 className="display text-3xl">Bem-vinda de volta</h1>
          <p className="mt-1 text-sm text-plum-600/70">Entre para gerenciar sua agenda.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
