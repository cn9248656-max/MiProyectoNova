# syntax=docker/dockerfile:1

# Etapa 1: dependencias (con herramientas para compilar better-sqlite3)
FROM node:24-alpine AS deps
RUN apk upgrade --no-cache && apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Etapa 2: compilación de Next.js (solo código fuente, sin node_modules local)
FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json next.config.mjs ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY proxy.ts ./proxy.ts
RUN npm run build

# Etapa 3: ejecución
FROM node:24-alpine AS runner
RUN apk upgrade --no-cache && apk add --no-cache libstdc++
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

RUN mkdir -p /app/data

EXPOSE 3000
CMD ["npm", "start"]
