# Task Management App

Fullstack Kanban app built with Next.js 16 App Router, Drizzle ORM, MinIO and NextAuth.js. Built spec-first with [Kiro](https://kiro.dev): requirements, technical design, and property-based tests before any code.

## Stack

- **Framework** — Next.js 16 (App Router, Server Actions)
- **Auth** — NextAuth.js v5 (email/password + Google OAuth)
- **Database** — MySQL 8 + Drizzle ORM
- **Storage** — MinIO (S3-compatible, file attachments)
- **UI** — ShadCN/UI + Tailwind CSS v4
- **Drag & Drop** — @dnd-kit
- **PWA** — Service Worker + Web App Manifest
- **Testing** — Vitest + fast-check (property-based testing)
- **Infrastructure** — Docker Compose

## Features

- Kanban boards with columns and cards
- Drag & drop reordering for columns and cards
- File attachments per card (stored in MinIO, signed URLs for download)
- Email/password registration and login
- Google OAuth
- PWA — installable, offline support via Service Worker
- Cascade deletion (board → columns → cards → attachments)

## Getting Started

### Prerequisites

- Node.js 20+
- Docker + Docker Compose

### 1. Clone and install

```bash
git clone <repo-url>
cd task-management-app
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values. For local development the defaults work out of the box.

For Google OAuth, create credentials at [console.cloud.google.com](https://console.cloud.google.com) and set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### 3. Start infrastructure

```bash
docker compose up -d
```

This starts MySQL on port `3306`, MinIO on port `9002` (console on `9001`), and automatically creates the `attachments` bucket.

### 4. Run migrations

```bash
npm run db:migrate
```

### 5. Start the app

```bash
npm run dev
```

App available at [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `MYSQL_ROOT_PASSWORD` | MySQL root password |
| `MYSQL_DATABASE` | Database name |
| `MINIO_ENDPOINT` | MinIO host |
| `MINIO_PORT` | MinIO API port |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `MINIO_BUCKET` | Bucket name for attachments |
| `NEXTAUTH_SECRET` | NextAuth.js secret (use a strong random value in production) |
| `NEXTAUTH_URL` | App base URL |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

## Database

```bash
npm run db:generate   # generate migrations from schema changes
npm run db:migrate    # apply migrations
npm run db:push       # push schema directly (dev only)
```

Entities are defined in separate Drizzle schema files under `src/server/db/schema/`.

## Testing

```bash
npm run test
```

Tests use **Vitest** for unit tests and **fast-check** for property-based testing. 19 correctness properties are formalized and verified, including:

- Round-trip create/read for boards, columns, cards
- Cascade deletion integrity
- Upload atomicity (no orphan metadata if MinIO fails)
- File size rejection (> 20 MB)
- User data isolation (no cross-user data leaks)
- Access control (403 on unauthorized board access)

## Project Structure

```
src/
├── app/
│   ├── (auth)/         # login, register pages
│   ├── (app)/          # dashboard, board pages
│   └── api/            # auth + attachment download routes
├── components/
│   ├── board/          # KanbanBoard, BoardColumn, BoardCard
│   ├── card/           # CardDetail, AttachmentList
│   └── ui/             # ShadCN components
├── server/
│   ├── actions/        # Server Actions (board, column, card, attachment)
│   ├── services/       # business logic
│   └── db/
│       ├── index.ts    # Drizzle connection
│       └── schema/     # users, boards, columns, cards, attachments
└── lib/
    ├── auth.ts         # NextAuth config
    ├── minio.ts        # MinIO client
    └── validations.ts  # Zod schemas
```
