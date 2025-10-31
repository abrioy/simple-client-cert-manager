FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM caddy:2.7-alpine
RUN apk add --no-cache gettext
COPY --from=build /app/dist/ /usr/share/caddy/
COPY caddy/Caddyfile.template /etc/caddy/templates/Caddyfile.template
COPY caddy/config.js.template /etc/caddy/templates/config.js.template
COPY docker-entrypoint.sh /entrypoint.sh
EXPOSE 8080
ENTRYPOINT [ "/entrypoint.sh" ]
CMD [ "caddy", "run", "--config", "/etc/caddy/Caddyfile" ]