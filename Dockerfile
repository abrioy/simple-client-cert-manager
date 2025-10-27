# Build the React application
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# Bundle with nginx and proxy API calls to step-ca
FROM nginx:1.25-alpine AS runtime
WORKDIR /
RUN apk add --no-cache bash gettext
COPY --from=build /app/dist /usr/share/nginx/html
RUN mv /usr/share/nginx/html/config.js /usr/share/nginx/html/config.js.template
COPY nginx/nginx.conf.template /etc/nginx/templates/app.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
