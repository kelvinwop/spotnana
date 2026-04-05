# Spotnana Frontend

Frontend for the Spotnana assessment chat workspace. It keeps the product surface narrow: a landing page, the main chat workspace, guest/account auth transitions, and persisted AI settings through the Jotai persistence boundary.

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui primitives
- **State Management**: Jotai
- **Routing**: React Router
- **Icons**: Lucide React

## What this frontend does

- Presents a Spotnana-branded landing page and chat workspace
- Supports guest mode before sign-in
- Persists guest chat history and AI settings through the frontend persistence boundary
- Lets authenticated users sync new conversations and saved AI settings through the backend
- Keeps loading, retry, and duplicate-request states explicit in the chat UI

## Setup

### Prerequisites

- Node.js `^20.19.0 || >=22.12.0` or Bun
- Backend server running locally

### Installation

```bash
bun install
```

Create `.env` from the example file:

```bash
cp env.example .env
```

Frontend env:

```env
VITE_API_URL=http://localhost:5000
```

### Running

Development mode:

```bash
bun run dev
```

Build for production:

```bash
bun run build
```

Preview the production bundle locally:

```bash
bun run preview
```

## Project Structure

```text
frontend/
├── src/
│   ├── api/            # typed API clients and request helpers
│   ├── atoms/          # auth, chat, and persistence-backed UI state
│   ├── components/     # chat and UI building blocks
│   ├── hooks/          # feature hooks such as auth and chat app orchestration
│   ├── lib/            # shared UI utilities
│   ├── pages/          # HomePage and ChatPage
│   ├── App.tsx         # route tree
│   ├── main.tsx        # app bootstrap
│   └── index.css       # theme and global styles
├── components.json
├── env.example
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## UX Notes

- The landing page is intentionally lightweight and routes directly into `/chat`.
- Guest mode stays usable without forcing account creation.
- Account auth lives behind a dialog so the chat workspace remains the primary surface.
- Persisted browser state is limited to UI-safe data such as guest history and saved BYOK settings.

## Commands

- `bun run dev`
- `bun run lint`
- `bun run typecheck`
- `bun run build`

## License

MIT

