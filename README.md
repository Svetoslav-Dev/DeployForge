# DeployForge

A self-hosted deployment dashboard for Dockerized applications. Create and manage apps, trigger deployments, inspect container status, view logs, and automate deployments through GitHub webhooks — all from a clean technical dashboard UI protected by JWT authentication.

---

## Features

- **Authentication** — username/password login with short-lived JWT access tokens (1h) and rotating httpOnly refresh tokens (7d), role-based access (admin/viewer), rate-limited login (5 attempts / 15 min), and audit log with IP + browser metadata
- **Application management** — create, edit, and delete Dockerized applications with image, port, and environment configuration
- **Deployment engine** — trigger deployments manually or via GitHub webhook; deployments run asynchronously and stream structured logs
- **Docker integration** — pull images, run/stop/restart containers, inspect state — all via safe fixed-template `execFile` calls (no raw shell execution)
- **Deployment history** — every deployment is persisted with status, trigger type, duration, and full log output
- **GitHub webhook** — `POST /api/webhooks/github/:applicationId` validates `X-Hub-Signature-256` with HMAC-SHA256 and `timingSafeEqual`
- **Monitoring dashboard** — live summary of running/stopped/error app counts, failed deployment count, and recent deployments
- **Dark dashboard UI** — sidebar navigation, status badges, tables, logs viewer, and forms built with Next.js App Router and Tailwind CSS

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS |
| Backend | Fastify 4, TypeScript, Prisma 5 |
| Auth | JWT (`@fastify/jwt`), bcrypt |
| Database | PostgreSQL 16 |
| Infrastructure | Docker, Docker Compose |
| Shared types | `packages/shared` (pnpm workspace) |
| CI/CD | GitHub Actions |
| Testing | Vitest, Testing Library |
| Linting | ESLint 9 + typescript-eslint v8 (flat config) |

---

## Project Structure

```
deployforge/
  apps/
    web/                  # Next.js 16 frontend (App Router)
    api/                  # Fastify REST API
  packages/
    shared/               # Shared TypeScript types (Application, Deployment, etc.)
  docker-compose.yml
  .github/workflows/ci.yml
```

### API layout

```
apps/api/src/
  modules/
    applications/         # CRUD routes + service + Zod schema
      __tests__/          # Unit tests: schema validation, service logic
    auth/                 # Login, current-user, user management, audit-log routes
    deployments/          # Deployment history + logs routes + service
      __tests__/          # Unit tests: service with mocked DockerService
    docker/               # Docker CLI integration (pull/run/stop/restart/inspect)
    monitoring/           # Dashboard summary route
    webhooks/             # GitHub webhook route
      __tests__/          # Unit tests: HMAC signature verification
  plugins/
    env.ts                # Environment variable validation and decoration
    jwt.ts                # JWT auth plugin (global onRequest hook; skips /auth/login and webhooks)
    prisma.ts             # PrismaClient plugin (connect/disconnect lifecycle)
  test/
    setup-integration.ts  # Loads .env for integration test workers
  __tests__/              # Integration tests: full HTTP + real Postgres
  app.ts                  # Fastify app factory (shared by server and tests)
  seed.ts                 # Creates initial admin user (run once after first migrate)
  server.ts               # Process entry point
```

### Frontend layout

```
apps/web/src/
  app/
    (dashboard)/          # Authenticated route group (requires valid df_token cookie)
      applications/       # List, create, detail, edit, deployment history pages
      dashboard/          # Monitoring summary page
      deployments/        # All deployments list + detail + logs viewer
      layout.tsx          # Dashboard shell: sidebar + content area
    login/                # Sign-in page (public)
    layout.tsx            # Root layout
    page.tsx              # Redirects to /dashboard
  middleware.ts           # Edge middleware: redirects unauthenticated requests to /login
  components/
    layout/Sidebar.tsx    # Navigation sidebar
    ui/
      StatusBadge.tsx     # Coloured status chip
      ApplicationForm.tsx # Create/edit form (client component)
      ApplicationActions.tsx  # Deploy/stop/restart/delete buttons (client component)
      __tests__/          # Component tests
  lib/
    api.ts                # Typed fetch client for all API endpoints
    __tests__/            # API client tests
  test/
    setup.ts              # @testing-library/jest-dom setup
```

---

## Data Model

```
User
  id, username, passwordHash
  role: admin | viewer
  createdAt, updatedAt

AuthLog
  id, username, event (login_success | login_failure)
  ip, userAgent, os, browser, timestamp

Application
  id, name, description, dockerImage, containerName
  internalPort, externalPort, environment (JSON)
  status: stopped | running | error | deploying
  webhookSecret (optional, for GitHub webhooks)

Deployment
  id, applicationId
  status: pending | running | success | failed
  triggerType: manual | webhook | system
  startedAt, finishedAt, summary, errorMessage

DeploymentLog
  id, deploymentId
  level: info | warn | error | debug
  message, timestamp
```

---

## API Endpoints

```
# Auth (login, refresh, logout are public; all others require valid token)
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/auth/users        (admin)
POST   /api/auth/users        (admin)
DELETE /api/auth/users/:id    (admin)
GET    /api/auth/logs         (admin)

# Applications
GET    /api/applications
POST   /api/applications
GET    /api/applications/:id
PUT    /api/applications/:id
DELETE /api/applications/:id

POST   /api/applications/:id/deploy
POST   /api/applications/:id/stop
POST   /api/applications/:id/restart
GET    /api/applications/:id/status

# Deployments
GET    /api/deployments
GET    /api/deployments/:id
GET    /api/deployments/:id/logs

# Monitoring
GET    /api/monitoring/summary

# Webhooks (public — validated by HMAC-SHA256)
POST   /api/webhooks/github/:applicationId

GET    /health
```

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### 1. Clone and install

```bash
git clone <repo-url>
cd deployforge
pnpm install
```

### 2. Start the database

```bash
docker compose up -d db
```

### 3. Configure the API environment

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` and set a strong `JWT_SECRET`:

```
JWT_SECRET=replace-with-a-long-random-secret
```

All other defaults connect to the Docker Compose Postgres — no other edits needed for local dev.

### 4. Run database migrations

```bash
pnpm --filter api db:migrate
```

### 5. Seed the initial admin user

```bash
pnpm --filter api db:seed
# Prints the generated password — save it, it won't be shown again
```

To set a specific password instead of a random one:

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=yourpassword pnpm --filter api db:seed
```

### 6. Start the API

```bash
pnpm --filter api dev
# Listens on http://localhost:3001
```

### 7. Start the frontend

```bash
pnpm --filter web dev
# Listens on http://localhost:3000
```

Open `http://localhost:3000` — you will be redirected to `/login`.

---

## Running with Docker Compose (full stack)

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| API | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

The API container mounts `/var/run/docker.sock` so it can manage containers on the host.

---

## Testing

### Unit tests

Fast, no database required. Prisma and DockerService are mocked.

```bash
pnpm --filter api test       # 36 tests
pnpm --filter web test       # 16 tests
```

**What is covered:**

| File | Tests | What it checks |
|---|---|---|
| `applications.schema.test.ts` | 16 | Zod schema: name format, port ranges, env, webhookSecret length |
| `applications.service.test.ts` | 6 | Service methods call Prisma with correct arguments |
| `deployments.service.test.ts` | 7 | `trigger` creates deployment, sets status to deploying, returns immediately |
| `webhook-signature.test.ts` | 7 | HMAC-SHA256 validation: correct sig, tampered body, wrong secret, missing prefix |
| `StatusBadge.test.tsx` | 9 | Renders status text, applies correct colour class per status |
| `api.test.ts` | 7 | Fetch client calls correct URLs/methods, handles errors |

### Integration tests

Requires the PostgreSQL container (`docker compose up -d db`). Each suite boots a real Fastify instance and cleans up its own data between tests.

```bash
pnpm --filter api test:integration   # 47 tests
```

| File | Tests | What it covers |
|---|---|---|
| `applications.integration.test.ts` | 16 | Full HTTP CRUD: create, read, update, delete, 404s, duplicate rejection |
| `auth.integration.test.ts` | 21 | Login, refresh rotation, logout, audit logs, and role-based user management |
| `monitoring.integration.test.ts` | 4 | Summary counts, per-status breakdown, failed deployments, recent deployments cap |
| `webhooks.integration.test.ts` | 6 | 404 for unknown app, deploy on push, ignore non-push, missing/invalid/valid signature |

### Coverage

```bash
pnpm --filter api test:coverage
pnpm --filter web test:coverage
```

---

## GitHub Webhook Setup

1. Create an application in DeployForge and set a **Webhook Secret** (minimum 16 characters).
2. In your GitHub repository go to **Settings → Webhooks → Add webhook**.
3. Set the Payload URL:
   ```
   http://<your-server>:3001/api/webhooks/github/<applicationId>
   ```
4. Set **Content type** to `application/json`.
5. Enter the same value in **Secret**.
6. Select **Just the push event**.

Every push triggers a deployment. The endpoint validates `X-Hub-Signature-256` using `timingSafeEqual` to prevent timing attacks. If no secret is set on the application, signature validation is skipped (not recommended for public-facing deployments).

---

## Docker Integration

The API executes Docker operations using Node's `execFile` — values are passed as discrete argument arrays, never interpolated into shell strings.

| Operation | Command |
|---|---|
| Deploy | `docker pull <image>` → `docker stop/rm <container>` → `docker run -d --name … -p … --restart unless-stopped` |
| Restart | Skip pull, `docker stop/rm`, `docker run` (reuses pulled image) |
| Stop | `docker stop <container>` |
| Inspect | `docker inspect <container>` |

All output is stored as structured `DeploymentLog` rows (level: info/warn/error/debug) and displayed in the logs viewer.

---

## Security Notes

This is portfolio/demonstration software. Before exposing it to a network:

- **JWT secret** — set a strong, unique `JWT_SECRET` (32+ random characters). The default in `.env.example` is a placeholder.
- **Docker socket** — the API container mounts `/var/run/docker.sock`. Any authenticated user who can reach the API can trigger Docker operations on the host.
- **Webhook secrets** — strongly recommended. Without one, any HTTP POST triggers a deployment.
- **Port exposure** — containers start with `--restart unless-stopped`. Review `externalPort` values on shared hosts.
- **Environment variables** — stored as JSON in PostgreSQL. Masked in the UI but accessible via the API.
- **Viewer role** — viewers can read all data but cannot trigger deployments, stop, or restart containers. Only admins can perform write operations on running infrastructure.

---

## CI/CD (GitHub Actions)

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

| Job | Depends on | What it checks |
|---|---|---|
| `typecheck` | — | `tsc --noEmit` for api, web, and shared |
| `lint` | — | ESLint (api: typescript-eslint flat config, web: eslint-config-next) |
| `unit-tests` | — | Vitest unit tests for api (36) and web (16) |
| `integration-tests` | — | Vitest integration tests (47) against a Postgres 16 service container; runs Prisma migrations first |
| `build` | typecheck, unit-tests | Production builds for api (`tsc`) and web (`next build`) |
