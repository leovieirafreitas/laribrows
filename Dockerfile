# Lari Brows — imagem para EasyPanel (ou qualquer servidor com Docker).
# Build: docker build -t laribrows .   ·   Run: docker run -p 3000:3000 --env-file .env laribrows

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 1) Dependências
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 2) Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Endereço público usado nas páginas geradas durante o build (o resto lê as variáveis ao rodar).
ARG NEXT_PUBLIC_SITE_URL=https://laribrows.com.br
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
# (a pasta public pode não existir no Git quando está vazia)
RUN mkdir -p public && npm run build

# 3) Servidor
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
