# Birge: веб-нұсқа + сервер бір контейнерде.
# docker build --build-arg EXPO_PUBLIC_OPERATOR_NAME="ЖШС Мысал" -t birge .

FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/app/package.json apps/app/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund
COPY . .
# Вебте API сол доменде болғандықтан EXPO_PUBLIC_API_URL бос қалады.
ARG EXPO_PUBLIC_API_URL=
ARG EXPO_PUBLIC_OPERATOR_NAME=
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL EXPO_PUBLIC_OPERATOR_NAME=$EXPO_PUBLIC_OPERATOR_NAME EXPO_OFFLINE=1 CI=1
RUN npm run build:web && npm run build:server

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY apps/server/package.json ./package.json
# @birge/shared сервер бандлының ішінде — жеке пакет ретінде керек емес.
RUN npm pkg delete dependencies.@birge/shared && npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /src/apps/server/dist ./dist
COPY --from=build /src/apps/app/dist ./web
ENV WEB_DIST=/app/web DATA_DIR=/data PORT=4000 HOST=0.0.0.0
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]
