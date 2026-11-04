FROM node:26.13.0-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node app.mjs server.mjs seed.mjs seed.json integration.test.mjs LICENSE ./
USER node
EXPOSE 6400
CMD ["node", "server.mjs"]
