-# Smart Restaurant — Run Locally

This guide walks you through running the full Smart Restaurant stack on your machine: the Node/Express backend, the React (Vite) frontend, and the Python ML microservice.

## 1. Prerequisites

Install these once:

| Tool                | Version    | Notes                                                |
| ------------------- | ---------- | ---------------------------------------------------- |
| **Node.js**         | 20.x LTS   | Includes `npm`. Used by the API server and the SPA.  |
| **Python**          | 3.11+      | For the ML microservice (FastAPI + scikit-learn).    |
| **MongoDB**         | 6.x or 7.x | Local instance on `localhost:27017`, or a free Atlas cluster. |
| **Git**             | any recent | To clone the repo.                                   |

Optional but recommended:
- **MongoDB Compass** — GUI for inspecting the database.
- **Postman** / **Bruno** — for hitting the REST API directly.

## 2. Clone & install

```bash
git clone <repo-url> SmartRestaurant_Final
cd SmartRestaurant_Final

# Backend (Node)
cd Server
npm install
cd ..

# Frontend (React + Vite)
cd Client
npm install
cd ..

# E2E tooling (optional, only if you'll run Playwright)
npm install
npx playwright install chromium
```

Then set up the Python ML service:

```bash
cd Server/ml_model_service
python -m venv .venv

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cd ../..
```

## 3. Configure environment variables

The repo ships with a working `Server/.env` for local development. Confirm/edit it:

```env
# Server/.env
PORT=8080
NODE_ENV=development

MONGO_URI=mongodb://localhost:27017/smart-restaurant

JWT_SECRET=change-me-locally
JWT_EXPIRES_IN=1d

AI_SERVICE_URL=http://localhost:8000
ML_MODEL_SERVICE_URL=http://localhost:5002

REORDER_LEAD_TIME_DAYS=3
REORDER_SAFETY_DAYS=2
CRON_TIMEZONE=UTC
```

If you want OpenAI-backed features (recipe / endorsement generation), also add:

```env
OPENAI_API_KEY=sk-...
```

> **Heads-up:** `Server/.env` is currently committed to the repo. Before pushing this project anywhere public, rotate `JWT_SECRET`, run `git rm --cached Server/.env`, and commit so it stops being tracked.

The frontend reads its API base URL from `Client/src/api/axios.js` (defaults to `http://localhost:8080`). No `.env` file is required for the client in dev.

## 4. Start MongoDB

Pick one:

```bash
# Option A — local install
mongod --dbpath /path/to/your/data

# Option B — Docker
docker run -d --name smart-restaurant-mongo -p 27017:27017 mongo:7
```

Verify it's up:

```bash
mongosh --eval "db.runCommand({ ping: 1 })"
```

## 5. Seed the database (first run only)

From the repo root:

```bash
cd Server
npm run seed              # base data: users, dishes, ingredients
npm run seed:ai-engine    # optional: extra data for AI/ML features
```

The base seed creates a default admin user — check `Server/src/infrastructure/config/seed.js` for the credentials.

## 6. Run the three services

You'll need **three terminals**, each kept open while you develop.

### Terminal 1 — ML microservice (Python / FastAPI)

```bash
cd Server
# activate the venv first (see step 2): ml_model_service/.venv
# NOTE: launch from Server/ in *package mode* (ml_model_service.main:app).
# The app uses package-relative imports, so `uvicorn main:app` from inside
# ml_model_service/ fails with "attempted relative import with no known parent package".
uvicorn ml_model_service.main:app --host 0.0.0.0 --port 5002 --reload
```

Health check: <http://localhost:5002/v1/health>

> **DB name:** the ML service defaults to the `smart_restaurant` database, but
> the Node backend uses `smart-restaurant` (see `MONGO_URI` in `Server/.env`).
> Export `MONGODB_URI=mongodb://localhost:27017/smart-restaurant` for the ML
> service so `/v1/optimize-pricing` reads the same data the backend writes.
>
> **Recipe generation (RAG) env:** `POST /v1/generate-recipe` reads its config
> from this process's environment (it does **not** load a `.env`). Before
> launching, export `GOOGLE_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`,
> `QDRANT_COLLECTION_NAME` (and optionally `RAG_EMBEDDING_PROVIDER`,
> `RAG_TOP_K`, `RAG_SCORE_THRESHOLD`) — see `.env.docker.example` for the
> values. Without them the endpoint returns `502 missing_env:*`. Note the
> backend's ML client timeout (`ML_SERVICE_TIMEOUT_MS`, default 30s) must stay
> above the ~10-15s Gemini round-trip, or the backend silently serves its
> heuristic fallback recipe instead of the real RAG result.

### Terminal 2 — Backend API (Node / Express)

```bash
cd Server
npm run dev
```

Runs on <http://localhost:8080>. Watches files via nodemon.

### Terminal 3 — Frontend (React / Vite)

```bash
cd Client
npm run dev
```

Open the URL Vite prints (typically <http://localhost:5173>).

## 7. Log in

Use the admin credentials from the seed script. From there you can navigate Dashboard, Inventory, Orders, Menu Management, AI Forecast, Dynamic Pricing, Customer Management, Waste Management, and Notifications.

## 8. Running the test suites

```bash
# Backend (Jest + Supertest, uses mongodb-memory-server — no real Mongo needed)
cd Server && npm test
cd Server && npm run test:coverage   # ≥80% gate, HTML report at Server/coverage/

# Frontend (Vitest + React Testing Library)
cd Client && npm test
cd Client && npm run test:coverage   # ≥75% global, ≥80% on pages/components

# ML service (pytest)
# Run from inside ml_model_service/ — pytest's "prepend" import mode walks up the
# package tree and puts Server/ on sys.path, so `from ml_model_service.main import app`
# resolves correctly AND the pyproject.toml config (testpaths, asyncio_mode) is found.
# (uvicorn does NOT do this, which is why the service itself is launched from Server/.)
cd Server/ml_model_service && pytest

# End-to-end (Playwright) — requires real Mongo + all 3 services running
# Terminal 1: cd Server && MONGO_URI=mongodb://localhost:27017/smart_restaurant_e2e npm start
# Terminal 2: cd Client && npm run dev
# Terminal 3:
npx playwright test
npx playwright show-report

# Everything in sequence:
npm run test:all
```

See `TESTING.md` for additional notes.

## 9. Common issues

| Symptom                                                   | Fix                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `ECONNREFUSED 127.0.0.1:27017`                            | MongoDB isn't running. Start `mongod` or your Docker container.                      |
| Backend logs `ML service unreachable`                     | Start the FastAPI service in Terminal 1 first (port 5002).                           |
| `EADDRINUSE: 8080` / `5173` / `5002`                      | Another process is on that port. Stop it, or change the port in `Server/.env` / Vite config. |
| Login fails with valid credentials after a re-seed        | Clear browser localStorage (the cached JWT is stale), then re-login.                 |
| `prophet` install fails on Python install                 | On Windows, install Microsoft C++ Build Tools; on macOS, `brew install cmake` first. |
| Playwright tests can't find browsers                      | Run `npx playwright install chromium` from the repo root.                            |

## 10. Project layout

```
SmartRestaurant_Final/
├── Client/                  # React + Vite frontend
│   └── src/{pages,components,context,hooks,api}
├── Server/                  # Node + Express backend
│   ├── src/{domain,application,infrastructure,interfaces,routes,middlewares}
│   ├── ml_model_service/    # Python FastAPI ML microservice
│   ├── scripts/             # Seed + migration scripts
│   └── __tests__/           # Jest tests
├── e2e/                     # Playwright end-to-end tests
└── specs/                   # Spec Kit feature specs (001–006)
```

That's it — happy hacking.
