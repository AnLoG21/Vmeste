FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:8000/api
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV VITE_API_URL=${VITE_API_URL}

# Install deps first so this layer stays cached when only src/ changes
COPY package.json ./
RUN npm config set registry "${NPM_REGISTRY}" \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 600000 \
  && npm install vite@^6.0.0 @vitejs/plugin-react@^4.4.1 react@^18.3.1 react-dom@^18.3.1 qrcode@^1.5.4

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src

RUN node node_modules/vite/bin/vite.js build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
