"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarDays, ClipboardList, Clock4, ExternalLink, LayoutDashboard, LogOut, Menu, MessageCircle, Settings2, Sparkles, Users, X } from "lucide-react";
import { logoutAction } from "@/app/admin/login/actions";
import { Logo } from "@/components/brand/Logo";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/admin/agendamentos", label: "Agendamentos", icon: ClipboardList },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/procedimentos", label: "Procedimentos", icon: Sparkles },
  { href: "/admin/horarios", label: "Horários e bloqueios", icon: Clock4 },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings2 },
];

export function AdminNav({ studioName, adminName, pendingBadge }: { studioName: string; adminName: string; pendingBadge: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch // carrega a página inteira em segundo plano: o clique abre na hora
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm transition ${active ? "bg-white text-plum-900 shadow-card" : "text-lavender-100/80 hover:bg-white/10 hover:text-white"}`}
          >
            <item.icon className={`size-4 ${active ? "text-lavender-600" : ""}`} />
            <span className="flex-1">{item.label}</span>
            {item.href === "/admin/agendamentos" && pendingBadge}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="mt-6 space-y-1 border-t border-white/10 pt-5">
      <Link href="/" target="_blank" className="flex items-center gap-3 rounded-2xl px-4 py-2 text-sm text-lavender-100/70 hover:bg-white/10 hover:text-white">
        <ExternalLink className="size-4" /> Ver site
      </Link>
      <form action={logoutAction}>
        <button className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-2 text-sm text-lavender-100/70 hover:bg-white/10 hover:text-white">
          <LogOut className="size-4" /> Sair
        </button>
      </form>
      <p className="px-4 pt-3 text-xs text-lavender-200/40">Olá, {adminName}</p>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-plum-950 px-4 py-7 lg:flex">
        <div className="mb-9 px-3">
          <Logo name={studioName} href="/admin" subtitle="painel" light />
        </div>
        {links}
        {footer}
      </aside>

      {/* Mobile */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-plum-950 px-5 py-3 lg:hidden">
        <Logo name={studioName} href="/admin" subtitle="" light />
        <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-full text-white hover:bg-white/10" aria-label="Abrir menu">
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-plum-950/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Fechar menu" />
          <aside className="absolute inset-y-0 left-0 flex w-72 animate-fade-up flex-col bg-plum-950 px-4 py-6">
            <div className="mb-8 flex items-center justify-between px-3">
              <Logo name={studioName} href="/admin" subtitle="painel" light />
              <button onClick={() => setOpen(false)} className="text-white" aria-label="Fechar">
                <X className="size-5" />
              </button>
            </div>
            {links}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}
