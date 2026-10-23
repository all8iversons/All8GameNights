FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.29-alpine

RUN apk add --no-cache jq

COPY deploy/unraid/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/unraid/entrypoint.sh /entrypoint.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
