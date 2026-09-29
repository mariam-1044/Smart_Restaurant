# Testing

This project has three test suites running on every push (see `.github/workflows/test.yml`).

## Backend (Jest + Supertest)

```bash
cd Server
npm install
npm test                  # full suite
npm run test:coverage     # + LCOV/HTML coverage at Server/coverage/
```

Coverage gate: ≥80% global lines/branches/functions/statements. Uses `mongodb-memory-server` (no real Mongo needed). Mocks OpenAI and the Python ML service via `jest.mock('openai')` and `nock`.

## Frontend (Vitest + React Testing Library)

```bash
cd Client
npm install
npm test                  # full suite
npm run test:coverage     # + coverage at Client/coverage/
```

Coverage gate: ≥75% global, ≥80% for `src/pages/**` and `src/components/**`. Uses `jsdom`. Mocks the project's axios wrapper at `Client/src/api/axios.js`.

## End-to-End (Playwright)

```bash
# Prerequisite: MongoDB running on localhost:27017
# In one terminal:
cd Server && npx cross-env MONGODB_URI=mongodb://localhost:27017/smart_restaurant_e2e npm start
# In another:
cd Client && npm run dev
# In a third (from repo root):
npm install
npx playwright install chromium
npx playwright test
npx playwright show-report
```

## All suites

```bash
npm run test:all   # from repo root: runs Jest → Vitest → Playwright sequentially
```

See `specs/006-full-test-suite/quickstart.md` for a more detailed walkthrough.