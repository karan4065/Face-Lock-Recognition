FROM node:18-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
