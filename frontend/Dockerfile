FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts \
    && sha256sum package-lock.json | cut -d ' ' -f 1 > node_modules/.package-lock.sha256

# Development
FROM deps AS dev
COPY docker-entrypoint.dev.sh /usr/local/bin/docker-entrypoint.dev.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.dev.sh
COPY . .
EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.dev.sh"]
CMD ["npx", "nuxt", "dev", "--host", "0.0.0.0", "--port", "3000"]

FROM deps AS build
COPY . .
RUN npm run build

# Production
FROM node:24-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
