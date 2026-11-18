# Lari Brows · Sistema do Studio

Site de agendamento online + painel administrativo para studio de sobrancelhas.
Visual lavanda e champagne, tipografia serifada elegante, pensado para celular.

## O que tem

**Site da cliente**
- Página inicial com procedimentos, valores e duração
- Agendamento em 4 passos: procedimento → dia e horário → dados → pagamento
- Calendário mostra só dias com horários livres (fechados, lotados e passados ficam apagados)
- Pagamento via **PIX** ou **cartão de crédito em até 12x** (InfinitePay), ou PIX com a chave do studio
- **Sinal de entrada** (padrão 50%), com opção da cliente pagar o total
- Página do agendamento atualiza sozinha quando o PIX cai; botão "Adicionar à agenda"

**Área da cliente** (`/entrar` → `/minha-conta`)
- Login sem senha: a cliente digita o e-mail e recebe um código/link (Supabase Auth)
- Vê próximos horários e histórico (tudo que foi agendado com aquele e-mail)
- Paga o que estiver pendente, **remarca** escolhendo novo dia/horário e **cancela** — até X horas antes (configurável no admin, padrão 24h)
- Edita nome e WhatsApp; ao agendar logada, os dados já vêm preenchidos

**Painel admin** (`/admin`)
- Dashboard: atendimentos de hoje, próximos 7 dias, recebido no mês, a receber, gráfico de 6 meses
- Agenda mensal: ver o dia, bloquear/liberar dia com um clique
- Agendamentos: filtros, busca, confirmar PIX, registrar pagamento no studio, concluir, faltou, cancelar, remarcar, anotações, botão de WhatsApp com mensagem pronta
- Lançamento manual (cliente que marcou pelo WhatsApp/Instagram)
- Procedimentos e valores (criar, editar, desativar)
- Horário da semana com pausa de almoço + bloqueio de datas (folgas, feriados, férias) e horários especiais
- Configurações: **cobrança (sinal % / total / sem pagamento online)**, formas de pagamento, chave PIX, dados do studio, regras da agenda, troca de senha

## Rodando no computador

Precisa do Node.js 22 ou mais novo.

```bash
npm install
cp .env.example .env.local      # depois edite o .env.local
npm run setup                   # cria as tabelas e os dados iniciais
npm run dev
```

Sem `DATABASE_URL`, o app usa um Postgres embutido (PGlite) em `./data/pglite` — ótimo para testar sem internet.
Com `DATABASE_URL` apontando para o Supabase, usa o banco de produção.

- Site: http://localhost:3000
- Painel: http://localhost:3000/admin — o primeiro acesso é criado pelo `npm run db:seed` com `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Esqueceu a senha? Use "Esqueci minha senha" na tela de login (link por e-mail, vale 30 min).
  Troque a senha em **Configurações → Seu acesso** depois do primeiro login.

## Formas de receber

| Opção | Como funciona | Precisa |
|---|---|---|
| **InfinitePay** (principal) | Checkout seguro da InfinitePay: PIX ou cartão em até 12x. Confirmação automática | `INFINITEPAY_HANDLE` (sua InfiniteTag) |
| **PIX com chave própria** | QR Code com a sua chave, sem taxa. A cliente toca em "Já fiz o PIX" e você confirma no painel | só a chave PIX (em Configurações) |
| Mercado Pago (alternativa) | PIX automático + Checkout Pro | `MP_ACCESS_TOKEN` |
| Modo simulação | Botões de "simular pagamento" para testar sem cobrar | `ALLOW_PAYMENT_SIMULATION="true"` — **só no computador de testes** |

Sem nenhuma forma configurada, o site **não oferece** pagamento online (e recusa tentativas). A simulação nunca liga sozinha.

### InfinitePay
- `INFINITEPAY_HANDLE`: sua InfiniteTag **sem o `$`**.
- `INFINITEPAY_API_KEY` (recomendada, `inchk_...`): tira a etapa "endereço de entrega" do pagamento (é um serviço no studio) e faz o link expirar junto com a reserva, aceitando um único pagamento. Crie em InfinitePay → Configurações do Checkout → Checkout Integrado → API Key (aparece uma vez só).
- O aviso de pagamento (webhook) é configurado sozinho em cada link (`/api/webhooks/infinitepay`) — só funciona com o site publicado em `https://`.
- O webhook da InfinitePay não é assinado: o sistema **sempre confirma** com a InfinitePay (`/payment_check`) antes de aprovar. Dados forjados não aprovam nada.
- Não existe ambiente de testes na InfinitePay: o teste final é uma compra real de baixo valor (mínimo R$ 1,00).
- Documentação: https://www.infinitepay.io/checkout-documentacao

## Banco de dados: Supabase

O banco de produção é o Postgres do Supabase (projeto `upulfsocjkboblonpdea`).

- As tabelas são criadas pela migração em `drizzle/0000_init.sql`.
- **RLS ligado em todas as tabelas, sem policies**: a chave pública (`sb_publishable_...`) não consegue ler nem gravar nada pela API REST do Supabase. O app acessa direto pelo Postgres (`DATABASE_URL`), por isso continua funcionando.
- Para conectar: Supabase → botão **Connect** → **Transaction pooler** → copie a URL (porta 6543), troque `[YOUR-PASSWORD]` pela senha do banco e cole em `DATABASE_URL`.
- Mudou o schema? `npm run db:generate` cria uma nova migração SQL em `drizzle/` para aplicar no Supabase.

### Login da área da cliente (Supabase Auth)

- Usa `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- E-mails de acesso enviados pelo **Resend** (SMTP próprio, já configurado no Supabase): remetente `Lari Brows <larissa@laribrows.com.br>`, domínio `laribrows.com.br` verificado.
- Modelos em português de `supabase/email/` já aplicados (código de 6 dígitos + botão que funciona em qualquer aparelho).
  O botão usa o endereço do site que enviou o e-mail (`NEXT_PUBLIC_SITE_URL`), então funciona tanto local quanto em produção.
- URL Configuration: Site URL = `https://laribrows.com.br`; Redirect URLs liberadas para `laribrows.com.br`, `www.laribrows.com.br` e `localhost:3000`.
- Limite: 60 e-mails/hora no Supabase (e 100/dia no plano grátis do Resend).

### WhatsApp (Evolution API)

- Painel → **WhatsApp**: status da conexão, QR Code para conectar, desconectar, mensagem de teste e histórico de envios.
- Mensagens automáticas (com textos editáveis e prévia): **confirmação** para a cliente quando o horário é confirmado ou remarcado,
  **lembrete** ~24h antes e **avisos para o studio** (novo agendamento, cancelamento e remarcação feitos pela cliente).
- Cada confirmação/lembrete é enviado uma vez só (`wa_confirm_sent_at` / `wa_reminder_sent_at`). Os lembretes rodam a cada 5 min
  dentro do próprio servidor (`src/instrumentation.ts`).
- Use o **token da instância** em `EVOLUTION_API_KEY` — a chave geral do servidor Evolution não é necessária.

## Publicando (produção)

O site roda em qualquer servidor com Docker (`Dockerfile` na raiz, saída `standalone` do Next.js).
O banco continua no **Supabase**.

### EasyPanel

1. **Fonte → Git**: URL `https://github.com/leovieirafreitas/laribrows.git`, ramo `main`, caminho de build `/`.
2. **Construção (Build)**: escolha **Dockerfile** (arquivo `Dockerfile`).
3. **Ambiente**: cole as variáveis da tabela abaixo.
4. **Domínios**: adicione `laribrows.com.br` (e `www.laribrows.com.br`), com HTTPS, protocolo HTTP e a **mesma porta do domínio padrão do EasyPanel** (normalmente **80** — o EasyPanel define a variável `PORT` do app; fora dele o padrão é 3000).
   No DNS do domínio, crie um registro **A** de `@` (e de `www`) para o IP do servidor.
   Não apague os registros do Resend (e-mail) que já estão lá.
5. **Implantar**. Cada novo `git push` na `main` pode ser publicado com "Implantar" (ou ative o deploy automático).

As variáveis `NEXT_PUBLIC_*` são lidas quando o servidor roda (`src/lib/env.ts`), então não precisam existir no build.

### Variáveis de ambiente

| Variável | Valor |
|---|---|
| `DATABASE_URL` | URL do *Transaction pooler* do Supabase (porta 6543), com a senha |
| `SESSION_SECRET` | uma chave **nova** (`openssl rand -base64 32`) |
| `NEXT_PUBLIC_SITE_URL` | `https://laribrows.com.br` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | do Supabase |
| `RESEND_API_KEY` | chave do Resend ("Esqueci minha senha" do painel) |
| `EMAIL_FROM` | `Lari Brows <larissa@laribrows.com.br>` |
| `INFINITEPAY_HANDLE` | sua InfiniteTag (sem `$`) |
| `INFINITEPAY_API_KEY` | recomendada: tira a etapa de endereço de entrega e faz o link expirar com a reserva |
| `EVOLUTION_API_URL` / `EVOLUTION_INSTANCE` / `EVOLUTION_API_KEY` | WhatsApp pela Evolution API (token da instância) |
| `ALLOW_PAYMENT_SIMULATION` | **não defina** (ou `false`) |

Também funciona na **Vercel** (importe o repositório e cadastre as mesmas variáveis; o `vercel.json` coloca o servidor em `iad1`, perto do banco em Ohio).

**Desempenho:** o banco está em Ohio (EUA). Com o servidor no Brasil, cada consulta leva ~150–200 ms.
Se o painel ficar lento, o caminho é mover o Supabase para São Paulo (`sa-east-1`) ou usar um servidor nos EUA.

## Regras importantes

- Ao escolher o horário, a vaga fica **reservada por 30 min** (configurável) enquanto a cliente paga. Se não pagar, o horário volta a ficar livre.
- Duas clientes nunca conseguem pegar o mesmo horário: a checagem é feita dentro de uma transação com trava por dia (`pg_advisory_xact_lock`).
- Datas e horários seguem o **horário de Manaus** (UTC−4), independente de onde o servidor ou a cliente estiverem. Para mudar, troque `STUDIO_TZ` em `src/lib/time.ts`.

## Estrutura

```
src/app/(site)/        site da cliente (início, agendar, página do agendamento)
src/app/admin/         painel (login + páginas em (painel)/) e ações do servidor
src/app/api/           disponibilidade, status do pagamento, webhook do Mercado Pago
src/lib/availability   cálculo dos horários livres
src/lib/booking        reserva, cobrança e confirmação de pagamento
src/lib/payments/      Mercado Pago e gerador de PIX copia e cola
src/lib/db/schema.ts   tabelas (Drizzle ORM)
drizzle/               migrações SQL
```

Comandos úteis: `npm run db:studio` (ver o banco no navegador), `npm run typecheck`, `npm run lint`.
