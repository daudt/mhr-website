FROM node:20-alpine

WORKDIR /app

# Install dependencies for sharp
RUN apk add --no-cache vips-dev

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js .

EXPOSE 3000

USER node

CMD ["node", "server.js"]
