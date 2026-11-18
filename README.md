# Lari Brows · Sistema do Studio

Site de agendamento online + painel administrativo para studio de sobrancelhas.
Visual lavanda e champagne, tipografia serifada elegante, pensado para celular.

## O que tem

**Site da cliente**
- Página inicial com procedimentos, valores e duração
- Agendamento em 4 passos: procedimento → dia e horário → dados → pagamento
- Calendário mostra só dias com horários livres (fechados, lotados e passados ficam apagados)
- Pagamento via **PIX** (QR Code + copia e cola) ou **cartão de crédito** (parcelado)
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
- Painel: http://localhost:3000/admin — entra com `ADMIN_EMAIL` / `ADMIN_PASSWORD` do `.env.local`.
  Troque a senha em **Configurações → Seu acesso** depois do primeiro login.

## Formas de receber

| Opção | Como funciona | Precisa |
|---|---|---|
| **PIX automático** | QR Code do Mercado Pago; confirma sozinho | `MP_ACCESS_TOKEN` |
| **Cartão de crédito** | Checkout seguro do Mercado Pago, parcelado | `MP_ACCESS_TOKEN` |
| **PIX com chave própria** | QR Code gerado com a sua chave, sem taxa. A cliente toca em "Já fiz o PIX" e você confirma no painel | só a chave PIX (em Configurações) |
| **Modo simulação** | Sem credenciais, tudo funciona com botões de "simular pagamento" para testar | nada |

### Conectando o Mercado Pago
1. Acesse https://www.mercadopago.com.br/developers/panel/app e crie uma aplicação (Checkout Pro / Pagamentos online).
2. Copie o **Access Token** (comece pelas credenciais de teste, `TEST-...`) para `MP_ACCESS_TOKEN` no `.env.local`.
3. Com o site publicado, cadastre o webhook em *Suas integrações → Webhooks* apontando para
   `https://SEU-DOMINIO/api/webhooks/mercadopago` (evento **Pagamentos**) e copie a assinatura secreta para `MP_WEBHOOK_SECRET`.
4. Para PIX automático, a conta precisa ter uma chave PIX cadastrada no Mercado Pago.

O sistema nunca confia só no aviso do webhook: ele consulta o pagamento na API do Mercado Pago e confere o valor antes de confirmar.

## Banco de dados: Supabase

O banco de produção é o Postgres do Supabase (projeto `upulfsocjkboblonpdea`).

- As tabelas são criadas pela migração em `drizzle/0000_init.sql`.
- **RLS ligado em todas as tabelas, sem policies**: a chave pública (`sb_publishable_...`) não consegue ler nem gravar nada pela API REST do Supabase. O app acessa direto pelo Postgres (`DATABASE_URL`), por isso continua funcionando.
- Para conectar: Supabase → botão **Connect** → **Transaction pooler** → copie a URL (porta 6543), troque `[YOUR-PASSWORD]` pela senha do banco e cole em `DATABASE_URL`.
- Mudou o schema? `npm run db:generate` cria uma nova migração SQL em `drizzle/` para aplicar no Supabase.

### Login da área da cliente (Supabase Auth)

- Usa `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Antes de abrir para as clientes, configure um SMTP próprio** (Supabase → Authentication → Emails → SMTP Settings; recomendado: Resend).
  Sem isso, o e-mail padrão do Supabase **só entrega para membros da sua organização** no Supabase e tem limite de poucos e-mails por hora.
- Com o SMTP configurado, aplique os modelos em português de `supabase/email/` (com código de 6 dígitos + link que funciona em qualquer aparelho).
- Em produção, ajuste em Authentication → URL Configuration: **Site URL** = seu domínio e inclua `https://seu-dominio/**` nas Redirect URLs.

## Publicando (produção)

Sugestão: **Vercel** (site) + **Supabase** (banco).

1. Na Vercel, configure as variáveis do `.env.example` (`DATABASE_URL` do pooler, `SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_*`, `MP_*`).
2. Faça o deploy.

## Regras importantes

- Ao escolher o horário, a vaga fica **reservada por 30 min** (configurável) enquanto a cliente paga. Se não pagar, o horário volta a ficar livre.
- Duas clientes nunca conseguem pegar o mesmo horário: a checagem é feita dentro de uma transação com trava por dia (`pg_advisory_xact_lock`).
- Datas e horários seguem o fuso de São Paulo, independente do servidor.

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
