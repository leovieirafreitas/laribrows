import Link from "next/link";
import { AtSign, CircleUserRound, MapPin, MessageCircle } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Ornament } from "@/components/brand/Ornament";
import type { Settings } from "@/lib/db/schema";
import { instagramLink, whatsappLink } from "@/lib/format";

export function SiteHeader({ s, loggedIn }: { s: Settings; loggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-lavender-200/50 bg-ivory/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Logo name={s.studioName} />
        <nav className="flex items-center gap-1 sm:gap-6">
          <Link href="/#procedimentos" className="hidden text-xs tracking-[0.2em] text-plum-700 uppercase transition hover:text-lavender-600 sm:inline">
            Procedimentos
          </Link>
          <Link href="/#studio" className="hidden text-xs tracking-[0.2em] text-plum-700 uppercase transition hover:text-lavender-600 sm:inline">
            O Studio
          </Link>
          <Link
            href={loggedIn ? "/minha-conta" : "/entrar"}
            className="flex items-center gap-1.5 rounded-full px-2 py-2 text-xs tracking-[0.2em] text-plum-700 uppercase transition hover:text-lavender-600 sm:px-0"
            aria-label={loggedIn ? "Minha conta" : "Entrar na área da cliente"}
          >
            <CircleUserRound className="size-5 sm:size-4" />
            <span className="hidden sm:inline">{loggedIn ? "Minha conta" : "Entrar"}</span>
          </Link>
          <Link href="/agendar" className="btn btn-primary btn-sm sm:px-5">
            Agendar
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ s }: { s: Settings }) {
  const wa = whatsappLink(s.whatsapp, `Olá! Vim pelo site da ${s.studioName} 💜`);
  const ig = instagramLink(s.instagram);
  return (
    <footer className="mt-auto bg-plum-950 text-lavender-100">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-3">
        <div>
          <Logo name={s.studioName} light />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-lavender-200/70">{s.tagline}</p>
        </div>
        <div className="space-y-3 text-sm">
          {(wa || ig || s.address) && <p className="text-[0.65rem] tracking-[0.3em] text-champagne-300 uppercase">Contato</p>}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-lavender-100/90 hover:text-white">
              <MessageCircle className="size-4 text-lavender-300" /> WhatsApp
            </a>
          )}
          {ig && (
            <a href={ig} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-lavender-100/90 hover:text-white">
              <AtSign className="size-4 text-lavender-300" /> {s.instagram.startsWith("@") ? s.instagram : `@${s.instagram}`}
            </a>
          )}
          {s.address && (
            <p className="flex items-start gap-2 text-lavender-100/90">
              <MapPin className="mt-0.5 size-4 shrink-0 text-lavender-300" />
              <span>
                {s.address}
                {s.city ? ` · ${s.city}` : ""}
              </span>
            </p>
          )}
        </div>
        <div className="md:text-right">
          <Link href="/agendar" className="btn border border-lavender-300/40 text-white hover:bg-white/10">
            Agendar meu horário
          </Link>
          <p className="mt-6 text-xs text-lavender-200/50">
            © {new Date().getFullYear()} {s.studioName}
          </p>
        </div>
      </div>
      <div className="flex justify-center pb-8 text-champagne-400/50">
        <Ornament />
      </div>
    </footer>
  );
}
