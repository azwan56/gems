# ============================================================
# Multi-stage Dockerfile for Gems Stock Screener (Next.js 16)
# Target: Google Cloud Run (output: "standalone", port 8080)
# ============================================================

FROM node:22-alpine AS base

# 1. Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 2. Build the Next.js standalone application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyBd55Vunk0gixXv9HO5XE5Ey_wyim59uh4"
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="dailystockrpt.firebaseapp.com"
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID="dailystockrpt"
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="dailystockrpt.firebasestorage.app"
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="91000643407"
ENV NEXT_PUBLIC_FIREBASE_APP_ID="1:91000643407:web:3205521bc141d34a99af3a"

RUN npm run build

# 3. Production runner image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
