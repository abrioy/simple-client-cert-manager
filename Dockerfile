FROM smallstep/step-cli:latest AS step

FROM node:20-bullseye-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:20-bullseye-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package.json ./
RUN npm install --omit=dev
COPY --from=step /usr/bin/step /usr/local/bin/step
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/app ./app
EXPOSE 3000
CMD ["npm", "run", "start"]
