# BRANDGUARD AI

BrandGuard AI is an AI-assisted brand-governance web app built for **CodeNexus India 2026 — Round 2**. It lets a team maintain approved brand knowledge, check draft content against it, resolve findings, and keep a human reviewer in control of final approval.

## What works

- Persistent MySQL-backed brand knowledge hub: guidelines, preferred terms, prohibited terms, and approved facts.
- Starter brand rules added automatically on first database setup.
- Content-review form with sample content, validation, loading state, and useful error messages.
- Server-side Gemini integration. The API key remains in `.env` and is never sent to the browser.
- Deterministic checks for prohibited terms, hype/tone language, and claims requiring verification.
- Gemini-assisted structured findings when configured: category, severity, excerpt, explanation, rule/source, suggested correction, and human-verification flag.
- Transparent score: starts at 100 and deducts 25/15/7/3 points for each critical/high/medium/low finding, capped at 0. It is explicitly not a compliance guarantee.
- Review report, suggestion accept/reject, automatic single-text replacement where possible, editable revised content, and revision history.
- Human approval workflow: submit for review, comment, approve, or request revision. AI never approves content.
- Dashboard metrics, recurring issue categories, and recent activity.

## Stack

- Node.js + Express
- EJS templates, vanilla JavaScript, responsive CSS
- MySQL 8+
- Google Gemini API (`@google/generative-ai`)

## Run locally

### 1. Prerequisites

Install Node.js 18+ and MySQL 8+ (or compatible MariaDB). Create a local database user with permission to create/use the `brandguard_ai` database.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example and edit the MySQL values:

```bash
copy .env.example .env
```

On macOS/Linux, use `cp .env.example .env` instead. At minimum, set:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=brandguard_ai
```

### 4. Initialize the database and sample rules

```bash
npm run db:init
```

This applies [`database/schema.sql`](database/schema.sql) and idempotently adds the sample rules. It does not erase existing review data.

### 5. Start the application

```bash
npm run dev
```

or:

```bash
npm start
```

Visit [http://localhost:3000](http://localhost:3000).

## Gemini configuration

1. Create an API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Add it only to your local/deployment environment, never to frontend code or Git:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
```

3. Restart the server.

When no key is configured—or Gemini cannot be reached—the application stays functional with its deterministic local rule engine and clearly labels that state. This avoids pretending an AI check ran when it did not.

Gemini receives the content being reviewed and the saved rules as server-side context. Use a key and deployment configuration appropriate to your organisation’s data-handling requirements.

## MySQL notes

The database script creates these tables:

- `brand_rules`
- `content_reviews`
- `review_issues`
- `review_revisions`
- `review_comments`

For a managed database, set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in the host’s encrypted environment-variable panel. Run `npm run db:init` once against that database during deployment (or apply `database/schema.sql` through its SQL console).

## Deploy

This app can be deployed to Railway, Render, Fly.io, or any Node host with a managed MySQL service.

1. Push the project to a private or public Git repository. Do **not** commit `.env`.
2. Provision a MySQL database and import `database/schema.sql` / run `npm run db:init` using the production connection settings.
3. Create a web service using Node 18+.
4. Set the build command to `npm install` and start command to `npm start`.
5. Add `NODE_ENV=production`, `PORT` (if the host requires it), all `DB_*` variables, and `GEMINI_API_KEY` to the host’s secret environment variables.
6. Deploy and verify `/`, `/knowledge`, a content review, and the approval workflow.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET/POST | `/api/rules` | List or add brand rules |
| DELETE | `/api/rules/:id` | Delete a brand rule |
| POST | `/api/reviews` | Create and analyse a review |
| GET | `/api/reviews/:id` | Retrieve report, comments, and history |
| POST | `/api/reviews/:id/issues/:issueId/decision` | Accept or reject a suggestion |
| POST | `/api/reviews/:id/issues/:issueId/apply` | Apply one suggested correction |
| POST | `/api/reviews/:id/submit` | Submit revised content for human review |
| POST | `/api/reviews/:id/action` | Human approve or request revision |
| POST | `/api/reviews/:id/comments` | Add a review comment |

## Important limitations

Automated results are advisory, can be incomplete, and never establish that content is factually correct or legally compliant. Findings without sufficient rule-grounded evidence are marked for human verification. A human reviewer must make every final approval decision.
