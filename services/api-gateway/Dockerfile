# Build context is the repo root (see docker-compose.yml / render.yaml) so
# this Dockerfile can pull in the shared/ folder alongside the service code,
# same convention as the Python services.
FROM node:20-alpine AS base

WORKDIR /app

COPY services/api-gateway/package*.json ./
RUN npm ci --omit=dev

COPY services/api-gateway/src ./src
COPY shared ./shared

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:8000/health || exit 1

CMD ["node", "src/index.js"]
