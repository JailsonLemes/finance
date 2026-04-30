FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .

EXPOSE 3001

# migrate deploy aplica apenas migrações já commitadas — sem risco de perda de dados
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
