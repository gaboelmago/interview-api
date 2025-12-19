# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

# Install deps first for better caching
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build


# One-shot migrator image: contains Prisma CLI + migrations.
FROM node:22-alpine AS migrator
WORKDIR /app

COPY package.json package-lock.json ./
# Install only dev dependencies (includes Prisma CLI)
RUN npm ci --omit=prod --ignore-scripts

COPY prisma ./prisma


FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Avoid @prisma/client postinstall attempting to run `prisma generate` (Prisma CLI is not present in prod-only deps)
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy generated Prisma engine/client artifacts from the builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
