# Build context is the repository root so the workspace lockfile is available.
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# npm ci checks the lockfile against every workspace, so both manifests are needed.
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci --omit=dev --workspace server && npm cache clean --force

COPY server/ server/

WORKDIR /app/server
USER node
EXPOSE 3000

# Apply pending migrations, then start the API.
CMD ["sh", "-c", "node src/db/migrate.js && exec node src/index.js"]
