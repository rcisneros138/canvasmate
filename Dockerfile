FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/package.json ./
RUN npm ci --workspace=server --omit=dev
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
