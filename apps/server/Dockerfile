FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/crdt/package.json packages/crdt/
COPY apps/server/package.json apps/server/
RUN npm ci --workspace apps/server --workspace packages/crdt --include-workspace-root

COPY packages/crdt packages/crdt
COPY apps/server apps/server

ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /app/apps/server
CMD ["npx", "tsx", "src/index.ts"]
