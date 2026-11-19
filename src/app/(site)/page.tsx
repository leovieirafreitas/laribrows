import Image from "next/image";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ArrowRight, CalendarHeart, Clock, CreditCard, Sparkles, Wand2 } from "lucide-react";
import { Ornament } from "@/components/brand/Ornament";
import larissa from "@/assets/larissa.jpg";
import { SectionTitle } from "@/components/ui";
import { db, services } from "@/lib/db";
import { formatBRL, formatDuration } from "@/lib/format";
import { servicePrice } from "@/lib/pricing";
import { getSettings, promoOf } from "@/lib/settings";
import { todayInStudio } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [s, rows] = await Promise.all([
    getSettings(),
    db.select().from(services).where(eq(services.active, true)).orderBy(asc(services.sortOrder), asc(services.name)),
  ]);
  const today = todayInStudio();
  const list = rows.map((svc) => ({ ...svc, ...servicePrice(svc, promoOf(s), today) }));

  const depositText =
    s.chargeMode === "deposit"
      ? `Garanta seu horário com ${s.depositPercent}% de sinal via PIX ou cartão.`
      : s.chargeMode === "full"
        ? "Pagamento online via PIX ou cartão de crédito."
        : "Agende em segundos e pague no dia do atendimento.";

  return (
    <>
      {/* ─────────────── Hero ─────────────── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-20 sm:px-8 md:grid-cols-[1.1fr_0.9fr] md:pt-20 md:pb-28">
          <div className="animate-fade-up">
            <p className="eyebrow">Studio de sobrancelhas</p>
            <h1 className="display mt-5 text-[3.2rem] leading-[1.05] sm:text-7xl">
              O olhar que <em className="font-normal text-lavender-600">revela</em>
              <br />a sua essência.
            </h1>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-plum-700/80">{s.tagline}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/agendar" className="btn btn-primary">
                Agendar horário <ArrowRight className="size-4" />
              </Link>
              <Link href="#procedimentos" className="btn btn-outline">
                Ver procedimentos
              </Link>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-plum-700/80">
              <span className="flex items-center gap-2">
                <CalendarHeart className="size-4 text-lavender-500" /> Agenda online 24h
              </span>
              <span className="flex items-center gap-2">
                <CreditCard className="size-4 text-lavender-500" /> PIX ou cartão
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm animate-fade-up [animation-delay:150ms]">
            {/* Brilho lavanda atrás da foto */}
            <div className="pointer-events-none absolute -inset-10 rounded-full bg-lavender-300/40 blur-3xl" />
            {/* Contorno champagne deslocado, no formato do arco */}
            <div className="pointer-events-none absolute -inset-3 rounded-t-full border border-champagne-400/80" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-t-full bg-lavender-200 shadow-[0_30px_60px_-20px_rgba(108,81,148,0.45)]">
              <Image
                src={larissa}
                alt={`Larissa, do ${s.studioName}`}
                fill
                priority
                placeholder="blur"
                sizes="(min-width: 768px) 384px, 90vw"
                className="object-cover object-[55%_30%]"
              />
              {/* Véu lavanda suave na base, para a foto conversar com a paleta do site */}
              <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-plum-900/35 via-lavender-500/10 to-transparent" />
            </div>
            {/* Brilhos dourados */}
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute -top-2 right-2 size-6 text-champagne-500" aria-hidden>
              <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" fill="currentColor" />
            </svg>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/3 -right-5 size-3.5 text-champagne-400" aria-hidden>
              <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" fill="currentColor" />
            </svg>
            <div className="card absolute -bottom-4 -left-6 hidden animate-float items-center gap-3 px-4 py-3 sm:flex">
              <span className="grid size-10 place-items-center rounded-full bg-lavender-100 text-lavender-700">
                <Sparkles className="size-5" />
              </span>
              <div>
                <p className="text-xs text-plum-600/70">Próximo passo</p>
                <p className="font-display text-lg leading-tight">Seu horário, em 1 minuto</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────── Procedimentos ─────────────── */}
      <section id="procedimentos" className="scroll-mt-24 border-y border-lavender-200/60 bg-white/50 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <SectionTitle eyebrow="Procedimentos" title={<>Cuidado em cada <em className="text-lavender-600">detalhe</em></>} center>
            Técnicas pensadas para valorizar a sua beleza natural. Escolha o procedimento e agende direto pelo site.
          </SectionTitle>
          <div className="mt-6 flex justify-center text-champagne-500">
            <Ornament />
          </div>

          {list.length === 0 ? (
            <p className="mt-12 text-center text-plum-600/70">Em breve, nossos procedimentos estarão disponíveis aqui.</p>
          ) : (
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((svc, i) => (
                <article
                  key={svc.id}
                  className="card group flex animate-fade-up flex-col p-7 transition duration-500 hover:-translate-y-1 hover:border-lavender-300"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {svc.promoLabel && (
                    <span className="mb-3 self-start rounded-full bg-plum-900 px-3 py-1 text-[0.62rem] tracking-[0.2em] text-champagne-300 uppercase">
                      {svc.promoLabel}
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-display text-2xl leading-tight font-normal">{svc.name}</h3>
                    <span className="mt-1 h-px w-8 shrink-0 bg-champagne-400 transition-all duration-500 group-hover:w-12" />
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-plum-700/75">{svc.description}</p>
                  <div className="mt-6 flex items-end justify-between border-t border-lavender-100 pt-5">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs text-plum-600/70">
                        <Clock className="size-3.5" /> {formatDuration(svc.durationMin)}
                      </p>
                      {svc.fullPriceCents != null && (
                        <p className="mt-1 text-sm text-plum-600/60 line-through">{formatBRL(svc.fullPriceCents)}</p>
                      )}
                      <p className={`font-display text-3xl text-plum-900 ${svc.fullPriceCents != null ? "" : "mt-1"}`}>{formatBRL(svc.priceCents)}</p>
                    </div>
                    <Link href={`/agendar?servico=${svc.id}`} className="btn btn-soft btn-sm">
                      Agendar
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─────────────── Como funciona ─────────────── */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <SectionTitle eyebrow="Como funciona" title={<>Agendar é <em className="text-lavender-600">simples</em></>} center />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { icon: Wand2, title: "Escolha o procedimento", text: "Veja valores e duração de cada técnica." },
              { icon: CalendarHeart, title: "Dia e horário", text: "O calendário mostra só os horários livres." },
              { icon: CreditCard, title: "Confirme", text: depositText },
            ].map((step, i) => (
              <div key={step.title} className="relative rounded-3xl p-7 text-center">
                <span className="font-display text-6xl text-lavender-200 italic">0{i + 1}</span>
                <div className="mx-auto -mt-6 grid size-12 place-items-center rounded-full bg-white text-lavender-600 shadow-card">
                  <step.icon className="size-5" />
                </div>
                <h3 className="mt-5 font-display text-2xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-plum-700/75">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── O Studio ─────────────── */}
      <section id="studio" className="scroll-mt-24 pb-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-plum-900 px-8 py-14 text-center sm:px-16 sm:py-20">
            <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-lavender-500/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-champagne-400/20 blur-3xl" />
            <p className="relative text-[0.68rem] tracking-[0.32em] text-champagne-300 uppercase">O studio</p>
            <h2 className="relative mt-4 font-display text-4xl font-light text-white sm:text-5xl">
              Um momento só <em className="text-lavender-300">seu</em>.
            </h2>
            <p className="relative mx-auto mt-5 max-w-2xl leading-relaxed text-lavender-100/80">
              {s.about ||
                "Atendimento exclusivo, com hora marcada, em um ambiente pensado para você relaxar. Cada design é desenhado a partir do seu rosto, da sua história e do que você deseja expressar."}
            </p>
            <div className="relative mt-9 flex justify-center">
              <Link href="/agendar" className="btn bg-white text-plum-900 hover:bg-lavender-100">
                Quero agendar <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
