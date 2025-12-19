# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

# Install deps first for better caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build


FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# TODO: Slim this part down, right now we copy built app + node_modules (includes Prisma CLI)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
