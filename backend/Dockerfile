# Собирается из корня репозитория: docker build -f backend/Dockerfile .
# (контекст нужен целиком, потому что это npm-воркспейс монорепо).

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/package.json
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

FROM deps AS build
COPY packages/engine packages/engine
COPY backend backend
RUN npm run build -w packages/engine && npm run build -w backend

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/engine/package.json ./packages/engine/package.json
COPY --from=build /app/packages/engine/dist ./packages/engine/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist

EXPOSE 4000
CMD ["node", "backend/dist/server.js"]
