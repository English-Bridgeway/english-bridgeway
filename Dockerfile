# English-Bridgeway, both images from one build of the website so their files match:
#   web    (default): Nginx serving the built site; page requests go to the API for rendering.
#   server          : the API, which also renders pages for search engines (dist-ssr).
# docker-compose.yml builds each with `target:`.
FROM node:22-alpine AS site
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig*.json ./
COPY public ./public
COPY src ./src
COPY scripts ./scripts
# "/api" = same origin as the site (Nginx proxies it). Leave empty to build the demo-mode site with no backend.
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM node:22-alpine AS api-build
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

FROM node:22-alpine AS server
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=api-build /app/dist ./dist
COPY server/seed ./seed
COPY --from=site /app/dist ./web/dist
COPY --from=site /app/dist-ssr ./web/dist-ssr
ENV WEB_DIST=/app/web/dist
# Uploaded e-books and the app APK; Docker copies this owner onto new volumes.
RUN mkdir -p /app/uploads/ebooks /app/uploads/app && chown -R node:node /app/uploads
USER node
EXPOSE 4000
# On start the API creates its tables, loads seed/content.json into an empty database
# and creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD.
CMD ["node", "dist/index.js"]

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=site /app/dist /usr/share/nginx/html
EXPOSE 80
