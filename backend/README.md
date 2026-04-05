# Spotnana Backend

Backend service for the Spotnana assessment chat app. It exposes the auth and chat APIs that power guest and account-backed conversations, while keeping environment parsing and persistence boundaries explicit.

## Tech Stack

- **Runtime**: Bun
- **Framework**: ElysiaJS
- **Database**: MongoDB with Mongoose for account-backed mode
- **Authentication**: JWT with argon2id password hashing
- **Language**: TypeScript

## What this backend does

- Registers and authenticates users for account mode
- Persists account conversations server-side
- Accepts guest completions with caller-provided AI settings
- Stores per-account AI provider/model preferences for signed-in users
- Enforces duplicate-request rejection for concurrent identical prompts
- Exposes a health endpoint that reports database availability separately from process health

## Setup

### Prerequisites

- Bun installed: https://bun.sh/
- MongoDB available if you want account mode enabled locally

### Installation

```bash
bun install
```

Create `.env` from the example file:

```bash
cp env.example .env
```

Minimum local configuration:

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

`NODE_ENV` must resolve to one of `dev`, `prod`, or `test`.
When running backend tests in `test` mode, the destructive test-db acknowledgement env var must also be present so disposable databases are explicitly acknowledged.

### Running

Development mode:

```bash
bun run --watch src/server.ts
```

Standard start:

```bash
bun run src/server.ts
```

Default local URL: `http://localhost:5000`

## API Surface

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

## Project Structure

```text
backend/
├── src/
│   ├── config/        # env parsing, database selection, roles
│   ├── controllers/   # auth and chat handlers
│   ├── middlewares/   # auth and rate limiting boundaries
│   ├── models/        # user, session, and chat persistence models
│   ├── routes/        # versioned API route groups
│   ├── utils/         # jwt + hashing helpers
│   └── server.ts      # Bun/Elysia entrypoint
├── env.example
├── package.json
└── tsconfig.json
```

## Notes

- Guest mode remains usable even if MongoDB is unavailable.
- Account routes depend on database connectivity and return availability errors when MongoDB is down.
- Optional admin bootstrap env vars still exist for local development but are not part of the primary assessment flow.

## Commands

- `bun run lint`
- `bun run typecheck`
- `bun run build`

## License

MIT

