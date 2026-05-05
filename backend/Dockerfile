FROM node:20-alpine

RUN apk add --no-cache openssl mariadb-client rclone tzdata

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

RUN chmod +x entrypoint.sh

EXPOSE 3001

CMD ["sh", "entrypoint.sh"]
