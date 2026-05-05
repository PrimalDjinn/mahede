FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-*.yaml /app/

RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

CMD [ "node", "/app/init.mjs" ]
