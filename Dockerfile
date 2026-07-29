# Multi-stage build for B1App Next.js application
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files and scripts for postinstall
COPY package.json yarn.lock .yarnrc.yml ./
COPY scripts ./scripts
COPY .yarn/patches ./.yarn/patches
RUN corepack enable && yarn install --immutable

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Build arguments must be declared before use
ARG BUILD_ENV=production
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Run postinstall to copy vendor CSS/locales into src/styles/vendor and public/
RUN corepack enable && YARN_ENABLE_SCRIPTS=true yarn postinstall

# Copy the appropriate environment file
RUN if [ "$BUILD_ENV" = "demo" ]; then \
      cp .env.demo .env.production.local; \
    elif [ "$BUILD_ENV" = "staging" ]; then \
      cp .env.staging .env.production.local; \
    else \
      cp .env.production .env.production.local; \
    fi

# Build Next.js application
RUN corepack enable && yarn build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/.env.production.local ./.env.production.local

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
