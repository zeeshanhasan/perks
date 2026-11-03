# Tofo Perks production image (Railway). SQLite lives on a mounted volume (DATABASE_URL=file:/data/perks.sqlite).
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY . .
RUN npm ci --no-audit --no-fund && npx prisma generate && npm run build && npm prune --omit=dev

FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
# Apply migrations, then serve. react-router-serve honours $PORT.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
