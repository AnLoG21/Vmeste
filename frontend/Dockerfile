FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:8000/api
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json package-lock.json ./
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src

RUN npm install
RUN node node_modules/vite/bin/vite.js build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  root /usr/share/nginx/html;' \
  '  location /assets/ {' \
  '    expires 1y;' \
  '    add_header Cache-Control "public, max-age=31536000, immutable";' \
  '    try_files $uri =404;' \
  '  }' \
  '  location ~* \.html$ {' \
  '    add_header Cache-Control "no-cache, no-store, must-revalidate";' \
  '    add_header Pragma "no-cache";' \
  '    add_header Expires "0";' \
  '    try_files $uri =404;' \
  '  }' \
  '  location / {' \
  '    add_header Cache-Control "no-cache, no-store, must-revalidate";' \
  '    add_header Pragma "no-cache";' \
  '    add_header Expires "0";' \
  '    try_files $uri $uri.html $uri/ /index.html;' \
  '  }' \
  '}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
