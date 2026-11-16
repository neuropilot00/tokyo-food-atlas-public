FROM node:24-bookworm-slim
WORKDIR /app
COPY public ./public
COPY lib ./lib
COPY app/ui-shell.ts app/globals.css ./app/
COPY drizzle ./drizzle
COPY railway ./railway
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node","railway/server.mjs"]
