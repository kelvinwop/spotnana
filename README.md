# Spotnana AI Chat Assessment App

## Hosted version [here](https://spotnana.soleye.com/)

A purpose-built AI chat application for the Spotnana frontend engineer assessment.
This repository focuses on BYOK prompt submission, guest/account persistence, model selection,
loading and error states, and duplicate-request defense.

## What ships in this repo

- **Frontend:** React + Vite + Tailwind + Jotai + TypeScript
- **Backend:** Bun + Elysia + MongoDB (for account mode) + TypeScript
- **Auth:** JWT + server-side session records for account mode
- **Guest mode:** conversation history persisted locally through the Jotai persistence boundary
- **Account mode:** conversation history persisted on the backend and tied to the signed-in user
- **BYOK AI access:** guests store their own key locally, authenticated users can persist theirs on the account model

## Runtime requirements

- **Backend:** Bun
- **Frontend:** Node.js `^20.19.0 || >=22.12.0`
- **MongoDB:** required only if you want account mode
- **OpenAI or OpenRouter API key:** required per user for assistant responses in guest and account modes

## Quick start

### 1) Backend

```bash
cd backend
bun install
```

Create a backend env file:

- Unix/macOS:
  ```bash
  cp env.example .env
  ```
- PowerShell:
  ```powershell
  Copy-Item env.example .env
  ```

Set at minimum:

```env
NODE_ENV=dev
MONGO_URI=mongodb://localhost:27017
DEV_DB_NAME=spotnana_chat
PROD_DB_NAME=spotnana_chat_prod
EPHEMERAL_TEST_DB_NAME=spotnana_chat_test
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
```

Start the backend:

```bash
bun run src/server.ts
```

Or, during development:

```bash
bun run --watch src/server.ts
```

Backend URL: `http://localhost:5000`

### 2) Frontend

```bash
cd frontend
bun install
```

A frontend `.env` file is optional for local development. If it is omitted, the frontend defaults to:

```env
VITE_API_URL=http://localhost:5000
```

If you want to override that default, create a frontend env file:

- Unix/macOS:
  ```bash
  cp env.example .env
  ```
- PowerShell:
  ```powershell
  Copy-Item env.example .env
  ```

Start the frontend:

```bash
bun run dev
```

Frontend URL: `http://localhost:5173`

### Local routes

- `/` → chat workspace
- `/chat` → chat workspace
- `/home` → landing page

## Guest mode vs account mode

### Guest mode

- Works after the backend is running and the user adds their own API key in settings
- Does **not** require MongoDB to be reachable for the UI to load
- Persists chat history in the frontend persistence boundary

### Account mode

- Requires MongoDB connectivity
- Uses register/login and persists conversations server-side
- Syncs conversations across devices for the authenticated user
- Keeps saved AI settings on the account model for signed-in use

If MongoDB is unavailable, the backend still starts and `/health` reports the DB as unavailable.
Guest mode remains usable. Account-backed auth, settings, and conversation routes depend on MongoDB,
and the current code does not present one identical error shape across every public and authenticated route
while the database is unavailable.

## Environment model

The backend keeps a strict typed env boundary so runtime mode and database intent stay explicit.

### Required backend env vars

- `NODE_ENV`
- `MONGO_URI`
- `DEV_DB_NAME`
- `PROD_DB_NAME`
- `EPHEMERAL_TEST_DB_NAME`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

### Optional backend env vars

- `PORT` (defaults to `5000`)
- `FRONTEND_URL` (defaults to `http://localhost:5173`)
- `ADMIN_DEFAULT_EMAIL`
- `ADMIN_DEFAULT_PASSWORD`

### Frontend env vars

- `VITE_API_URL` (defaults to `http://localhost:5000`)

## API surface

### Public endpoints

- `GET /health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/chat/guest/completions`

### Authenticated endpoints

- `GET /api/v1/auth/me`
- `PUT /api/v1/auth/settings/ai`
- `POST /api/v1/auth/logout`
- `GET /api/v1/chat/conversations`
- `GET /api/v1/chat/conversations/:id`
- `POST /api/v1/chat/completions`
- `PUT /api/v1/chat/conversations/:id/title`
- `DELETE /api/v1/chat/conversations/:id`

## Abridged project structure

```text
.
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── utils/
│   │   └── server.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── atoms/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── types/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── tsconfig.base.json
```

## Commands

### Backend

- `bun run lint`
- `bun run typecheck`
- `bun run build` *(workspace QC invokes the declared baseline build flow)*
- `bun run test`

### Frontend

- `bun run dev`
- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test`

## Scope notes

This repository intentionally omits unrelated product surfaces so the implementation stays focused on the core chat, auth, persistence, and BYOK settings flows:

- no Stripe flows
- no Discord OAuth
- no admin dashboard
- no settings pages outside the chat workspace

For more implementation detail, see the workspace-specific READMEs in `backend/` and `frontend/`.
