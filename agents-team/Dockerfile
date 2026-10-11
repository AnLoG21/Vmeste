FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
CMD ["npx", "tsx", "src/index.ts"]
