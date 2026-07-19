FROM node:20-alpine

WORKDIR /app

# Patch OS packages to pick up security fixes (e.g. openexr CVEs pulled in
# transitively via vips-dev), then install build deps for sharp.
RUN apk upgrade --no-cache && apk add --no-cache vips-dev

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js .

EXPOSE 3000

USER node

CMD ["node", "server.js"]
