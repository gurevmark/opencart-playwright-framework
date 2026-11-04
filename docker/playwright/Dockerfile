# CI supplies the exact version resolved in the root package-lock.json.
ARG PLAYWRIGHT_VERSION=1.64.1
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble

ARG PLAYWRIGHT_VERSION
WORKDIR /app
ENV CI=true

# Keep this layer reusable when only tests or page objects change.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund \
    && node -e 'if (require("@playwright/test/package.json").version !== process.argv[1]) throw new Error("Playwright image and package versions must match")' "$PLAYWRIGHT_VERSION"

# npm's build cache stays under root's home; each runtime user gets a writable
# temporary home without inheriting a root-owned npm cache.
ENV HOME=/tmp

COPY playwright.config.ts tsconfig.json ./
COPY api ./api
COPY fixtures ./fixtures
COPY pages ./pages
COPY tests ./tests
COPY testdata ./testdata
COPY utils ./utils
COPY scripts/ci ./scripts/ci

CMD ["bash", "scripts/ci/run-tests.sh", "test:master", "chromium"]
