import type { Metadata } from "next";
import Link from "next/link";
import { Ornament } from "@/components/brand/Ornament";
import { instagramLink, whatsappLink } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Política de Privacidade" };

const UPDATED_AT = "18 de novembro de 2026";

export default async function PrivacidadePage() {
  const s = await getSettings();
  const wa = whatsappLink(s.whatsapp, `Olá! Tenho uma solicitação sobre meus dados pessoais.`);
  const ig = instagramLink(s.instagram);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="eyebrow">Transparência</p>
      <h1 className="display mt-3 text-5xl">
        Política de <em className="text-lavender-600">Privacidade</em>
      </h1>
      <p className="mt-3 text-sm text-plum-600/70">Atualizada em {UPDATED_AT}</p>
      <Ornament className="mt-6 text-champagne-500" />

      <div className="card mt-8 space-y-8 p-6 leading-relaxed text-plum-800 sm:p-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-plum-900 [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:space-y-1">
        <section>
          <h2>Quem somos</h2>
          <p>
            Esta política explica como o <strong>{s.studioName}</strong>
            {s.address ? ` (${s.address}${s.city ? `, ${s.city}` : ""})` : ""} trata os dados pessoais de quem agenda pelo nosso site, conforme a Lei
            Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD). Somos os responsáveis (controladores) por esses dados.
          </p>
        </section>

        <section>
          <h2>Quais dados coletamos</h2>
          <ul>
            <li>
              <strong>Para agendar:</strong> nome, WhatsApp, e-mail, procedimento, data e horário escolhidos e as observações que você quiser nos contar.
            </li>
            <li>
              <strong>Pagamento:</strong> valor, forma (PIX ou cartão) e a situação do pagamento. Os dados do cartão são digitados diretamente na página
              segura do nosso processador de pagamentos — <strong>não temos acesso a eles e não os guardamos</strong>.
            </li>
            <li>
              <strong>Área da cliente:</strong> seu e-mail e os dados que você atualizar no seu perfil.
            </li>
            <li>
              <strong>Dados técnicos:</strong> cookies essenciais para manter você conectada à sua conta. Não usamos cookies de publicidade nem de
              rastreamento.
            </li>
          </ul>
        </section>

        <section>
          <h2>Para que usamos</h2>
          <ul>
            <li>Reservar, confirmar, remarcar ou cancelar seus horários (execução do serviço que você contratou).</li>
            <li>Falar com você sobre o atendimento — confirmação, lembretes e ajustes de horário — pelo WhatsApp ou e-mail.</li>
            <li>Registrar pagamentos e cumprir obrigações legais e fiscais.</li>
            <li>Manter um histórico dos seus atendimentos, para cuidar melhor de você nas próximas visitas.</li>
          </ul>
          <p>Não vendemos nem alugamos seus dados, e não os usamos para propaganda de terceiros.</p>
        </section>

        <section>
          <h2>Com quem compartilhamos</h2>
          <p>Somente com os serviços necessários para o site funcionar:</p>
          <ul>
            <li>
              <strong>Processador de pagamentos</strong> (InfinitePay): recebe nome, contato e valor para processar o PIX ou o cartão.
            </li>
            <li>
              <strong>Hospedagem e banco de dados</strong> (Vercel e Supabase): guardam o site e os dados com segurança, podendo estar em servidores fora do
              Brasil, com as garantias exigidas pela LGPD.
            </li>
            <li>
              <strong>Envio de e-mails</strong>: para mandar o código de acesso da área da cliente.
            </li>
          </ul>
          <p>Também podemos compartilhar dados quando a lei ou uma autoridade exigir.</p>
        </section>

        <section>
          <h2>Por quanto tempo guardamos</h2>
          <p>
            Guardamos seus dados enquanto você for nossa cliente e pelo tempo necessário para cumprir obrigações legais (por exemplo, registros de
            pagamento, que a lei pede para guardar por até 5 anos). Depois disso, eles são apagados ou anonimizados.
          </p>
        </section>

        <section>
          <h2>Seus direitos</h2>
          <p>A qualquer momento você pode pedir para:</p>
          <ul>
            <li>confirmar se tratamos seus dados e ter acesso a eles;</li>
            <li>corrigir dados incompletos ou desatualizados (o nome e o WhatsApp você mesma pode alterar na área da cliente);</li>
            <li>apagar seus dados, quando não houver obrigação legal de mantê-los;</li>
            <li>saber com quem compartilhamos seus dados;</li>
            <li>revogar autorizações e tirar dúvidas sobre esta política.</li>
          </ul>
          <p>
            Para isso, fale com a gente
            {wa ? (
              <>
                {" "}
                pelo{" "}
                <a href={wa} target="_blank" rel="noreferrer" className="text-lavender-700 underline">
                  WhatsApp
                </a>
              </>
            ) : null}
            {ig ? (
              <>
                {wa ? " ou" : ""} pelo{" "}
                <a href={ig} target="_blank" rel="noreferrer" className="text-lavender-700 underline">
                  Instagram
                </a>
              </>
            ) : null}
            . Respondemos o quanto antes. Você também pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
        </section>

        <section>
          <h2>Segurança</h2>
          <p>
            Usamos conexão criptografada (HTTPS), acesso restrito ao painel do studio e banco de dados protegido. Nenhum sistema é 100% invulnerável,
            mas trabalhamos para proteger seus dados e avisaremos você caso algo relevante aconteça.
          </p>
        </section>

        <section>
          <h2>Mudanças nesta política</h2>
          <p>Se atualizarmos esta política, a nova versão será publicada nesta página, com a data de atualização.</p>
        </section>
      </div>

      <p className="mt-8 text-center text-sm text-plum-600/70">
        <Link href="/agendar" className="text-lavender-700 underline">
          Voltar para o agendamento
        </Link>
      </p>
    </div>
  );
}
