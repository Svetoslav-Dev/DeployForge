FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json ./
COPY prisma ./prisma
RUN pnpm install
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run db:generate && pnpm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json ./
COPY prisma ./prisma
RUN pnpm install --prod
RUN pnpm run db:generate
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
