# English-Bridgeway API (Express + TypeScript). Built from the server/ folder.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY seed ./seed
USER node
EXPOSE 4000
# On start the API creates its tables, loads seed/content.json into an empty database
# and creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD.
CMD ["node", "dist/index.js"]
