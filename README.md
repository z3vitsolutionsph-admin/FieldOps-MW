# FieldOps MW

Offline-first field operations app for telecom microwave link installation, dismantling,
troubleshooting and TSSR verification. React + Vite client, Express API, Firestore storage,
Gemini assistant.

## Quick start (local demo)

```bash
bun install          # or npm install
cp .env.example .env # defaults: AUTH_MODE=dev, DATA_BACKEND=memory
npm run dev          # http://localhost:3000
```

In dev mode the login screen lets you pick a seeded demo identity, and the server keeps an
in-memory, seeded copy of the data. Neither is allowed when `NODE_ENV=production`: the server
refuses to start.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | API + Vite dev middleware from TypeScript source |
| `npm run build` | Client bundle (`dist/`) and server bundle (`dist-server/server.mjs`) |
| `npm start` | Runs the built server; defaults to production mode |
| `npm test` | API test suite (Vitest + Supertest, in-memory store) |
| `npm run lint` | Type check |
| `npm run set-claims -- <email> <ROLE> <orgId>` | Assign a user's role and organisation |

## Architecture

```
Browser (React)                     Server (Express, server/)                 Firestore
───────────────                     ─────────────────────────                 ─────────
AuthGate ── Firebase Auth ─┐        authenticate  → verifies ID token
                           │        (role, orgId from custom claims)
apiClient ── Bearer token ─┴──────► routes.ts     → zod validation
Dexie (offline replica)             services/     → RBAC, state machine,       orgs/{orgId}/
  └─ sync queue ── /api/sync/batch    audit trail, per-mutation results ────► work_orders, inventory,
geminiService ── /api/ai/*          AiService     → Gemini (server key)        tickets, photos,
                                                                               tssr_approvals, audit_logs
```

- **The server is the only writer.** Firestore rules deny every client write. Clients read and
  write through the API, which checks each call against the caller's verified role.
- **Tenant isolation is structural.** Every document lives under `orgs/{orgId}/…`, and the org
  always comes from the token, never from the request.
- **Work-order status changes only via `POST /api/work-orders/:id/transition`.** The allowed
  moves and the role each one needs are listed in `server/domain/workOrderStateMachine.ts`.
  `PATCH` accepts a whitelist of fields and never `status`, `orgId` or `history`.
- **Optimistic concurrency.** Work orders carry a `version`. Pass `expectedVersion` (REST) or
  `baseVersion` (sync) to get a `409` instead of silently overwriting a newer edit.
- **The sync gateway handles mutations one at a time.** A batch never fails as a whole. Each
  mutation comes back as `APPLIED`, `REJECTED` (not allowed or invalid) or `CONFLICT`. The client
  keeps rejected items for a person to review instead of retrying them forever.
- **The audit log is append-only and server-stamped.** Client audit events are kept, but the
  actor and the time come from the server.
- **The AI key never reaches the browser.** Prompts live on the server. User text goes into
  delimited data blocks, not into the instructions. Requests are rate-limited per user. If the
  model is unavailable, each client feature falls back to an offline heuristic.

## Deploying to production

1. Enable **Email/Password** sign-in in Firebase Authentication.
2. Deploy the rules: `firebase deploy --only firestore:rules`.
3. Give the Cloud Run service account the *Cloud Datastore User* and *Firebase Authentication
   Admin* roles.
4. Set `GEMINI_API_KEY`, and leave `AUTH_MODE` and `DATA_BACKEND` unset (they default to
   `firebase` and `firestore` in production).
5. For each user: `npm run set-claims -- user@company.com TECHNICIAN org-crane-ph`.
6. Data written by earlier versions sits in top-level collections, which the new rules close.
   Copy it under `orgs/{orgId}/…` before switching over.

Roles: `ADMIN`, `PROJECT_MANAGER`, `REVIEWER`, `SUPERVISOR`, `TEAM_LEADER`, `TECHNICIAN`,
`TOWER_CLIMBER`. Their permissions are in `src/services/rbacService.ts`, which the client and the
server share.

## Known limitations / next steps

- Photos sync as base64 in Firestore documents, capped at about 900 KB. They should move to Cloud
  Storage with signed upload URLs.
- Rate limits and the CSP are per instance and report-only. Add a shared rate-limit store
  (e.g. Redis) once traffic warrants it, and enforce the CSP once its reports are clean.
- The offline client does not yet send `baseVersion`, so offline edits are last-writer-wins on
  whitelisted fields.
- The battery telemetry endpoint returns a simulated curve (flagged `simulated: true`).
- There is no service worker or web manifest yet, so the app is not installable as a PWA.
