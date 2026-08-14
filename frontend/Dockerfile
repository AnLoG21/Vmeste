FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:8000/api
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV VITE_API_URL=${VITE_API_URL}
# Keep install layer cacheable; production mode only for the Vite step.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

COPY package*.json ./
RUN npm config set registry "${NPM_REGISTRY}" \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 600000 \
  && npm ci --omit=dev --ignore-scripts --no-audit --no-fund

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src

ENV NODE_ENV=production
RUN node node_modules/vite/bin/vite.js build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
