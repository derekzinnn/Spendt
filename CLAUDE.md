# Spendly — CLAUDE.md

Personal finance planner for a couple: one shared household where both people log expenses,
incomes, cards and bills. "The Excel of our life" — fast entry, editable grids, totals
everywhere — plus a real dashboard of where the money goes.

In the UI the product is called **Casa** (`APP_NAME`, `apps/web/src/lib/brand.ts`); the repo,
packages and storage keys keep the `spendly` name.

- **UI:** Brazilian Portuguese (pt-BR) · BRL `R$ 1.234,56` · dates `dd/mm/yyyy` · timezone `America/Sao_Paulo`
- **Code, comments, commits, docs:** English
- **Users:** 2 people in one household (multi-user from day one; schema is multi-household-ready)
- **Devices:** mobile for quick entry, desktop for review/planning — both first-class
- **Money model:** everything belongs to the couple — no "mine/hers" expenses, no splits, no
  who-owes-whom; `paidById` only records who paid ("pago por")

> **Infra lives in this repo, the server is the user's** (2026-10-07). The `Dockerfile`,
> `docker-compose.yml` and `apps/web/nginx.conf` are ours to write and keep working — see
> [Deploy](#deploy-spendtderekdevbr). What stays with the user: the VPS itself, DNS, the
> shared Caddy at `~/infra/Caddyfile`, and the `.env` with the real secrets (never in git).
> Still not ours to create: CI files.

> **Teaching rule:** whenever a new technical concept is introduced, first explain it in
> "banana-simple" language with an everyday analogy, then technically. See [Glossary](#glossary-banana-simple).

---

## Status

| Phase | Scope                                                                                 | Status                   |
| ----- | ------------------------------------------------------------------------------------- | ------------------------ |
| **0** | Monorepo, tooling, full Prisma schema, seed, design system, AppShell, design showcase | ✅ **Done** (2026-10-03) |
| **1** | Auth, household, invite flow, categories, accounts                                    | ✅ **Done** (2026-10-03) |
| **2** | Credit cards, invoice engine (closing/due logic), installments                        | ✅ **Done** (2026-10-04) |
| **3** | Transactions grid ("Excel"), quick add, command palette, recurring rules              | ✅ **Done** (2026-10-04) |
| **4** | Bills to pay (list + calendar), invoice payment, incomes                              | ✅ **Done** (2026-10-05) |
| **5** | Dashboard, budgets and alerts, clickable drill-downs                                  | ✅ **Done** (2026-10-05) |
| **6** | Import/export CSV/XLSX, polish, accessibility and performance pass                    | ✅ **Done** (2026-10-05) |

Between Phase 1 and 2 (2026-10-04) the **Casa design system** replaced Terracota/Grafite and the
money model became **everything shared** — see
[that update](#design--shared-money-update--what-was-delivered-2026-10-04).

---

## Quick start

Requirements: Node 24+, pnpm 11, PostgreSQL 15+ (you provide it).

```bash
pnpm install                              # also runs `prisma generate` for the API
cp apps/api/.env.example apps/api/.env    # set DATABASE_URL and SEED_PASSWORD
pnpm db:deploy                            # apply migrations (or `pnpm db:migrate` while developing)
pnpm db:seed                              # demo household; SEED_RESET=true to recreate
pnpm dev                                  # API on :3333 + web on :5173 (Vite proxies /api)
```

Log in with the seeded `SEED_OWNER_EMAIL` / `SEED_PASSWORD`, or create a new account at
`/criar-conta`. The design system showcase lives at `/design` (after login).

**Tests need no setup:** `pnpm test` starts an in-memory Postgres (Prisma dev server / PGlite)
for the API integration tests. To run them against your own Postgres instead, set
`TEST_DATABASE_URL` (it is migrated and **wiped** between tests — never point it at real data).

| Command                                                      | What it does                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `pnpm dev` / `dev:web` / `dev:api`                           | Run both apps / only one                                             |
| `pnpm check`                                                 | typecheck + lint + tests (run before every commit)                   |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm format` | Individually                                                         |
| `pnpm build`                                                 | `apps/web/dist` (static files) + `apps/api/dist/server.js` (bundled) |
| `pnpm db:migrate`                                            | Create/apply a migration in development (`prisma migrate dev`)       |
| `pnpm db:deploy`                                             | Apply pending migrations (production: `prisma migrate deploy`)       |
| `pnpm db:seed` · `pnpm db:studio`                            | Seed demo data · open Prisma Studio                                  |

### Deploy (spendt.derek.dev.br)

One VPS (Oracle ARM, `~/projects/Spendt`) with a Caddy container shared by several
projects. `docker compose up -d --build` is the whole deploy:

| Container        | Image target | Job                                                          |
| ---------------- | ------------ | ------------------------------------------------------------ |
| `spendt-db`      | postgres:17  | The database. On the `internal` network **only**.            |
| `spendt-migrate` | `migrator`   | Runs `prisma migrate deploy` and exits; the API waits for it |
| `spendt-api`     | `api`        | `node dist/server.js` as the unprivileged `node` user        |
| `spendt-web`     | `web`        | nginx with `apps/web/dist` and the SPA fallback              |

- **Nothing publishes a port.** Caddy is the only thing on 80/443 and reaches the
  containers by name over the external `web` network.
- **The database is not on `web`.** Other projects share that network; a neighbour that
  gets compromised still cannot reach Postgres. (This is not hypothetical — a sibling
  container on this box was compromised and mining on 2026-10-06.)
- **Migrations run before the API starts**, as their own container. Deploying code whose
  columns do not exist yet is therefore impossible.
- The Caddy block lives in the user's `~/infra/Caddyfile`:
  `handle /api/*` → `spendt-api:3333` (keep the prefix — the API mounts at `/api`) and
  `handle` → `spendt-web:80`.
- **Backups:** `scripts/backup-db.sh` runs from the user's crontab at 03:15 and writes a
  verified `pg_dump -Fc` to `~/backups/spendt`, keeping 30 days. It renames the file only
  after `pg_restore --list` can read it, and prunes only after that, so a half-written dump
  never passes for a good one. Restore:
  `docker exec -i spendt-db pg_restore -U spendly -d spendly --clean --if-exists < FILE`
  (verified on 2026-10-09 against a scratch database: row counts, the sum of `amountCents`
  and text all matched).
- **Off-site copy:** `scripts/pull-backups.ps1` runs on the user's Windows machine from a
  Task Scheduler entry (`scripts/install-backup-task.ps1`, daily 10:00, `StartWhenAvailable`
  so a day with the machine off is caught up, not skipped). It pulls over the existing
  `portfolio` SSH host, skips what it already has, writes to `.part` first and keeps 90 days
  in `~/backups/spendt`, with its own `pull.log`. Verified end-to-end on 2026-10-09.
- **The gap that is left:** the off-site copy only advances when that machine is on. The VPS
  copy covers accidents; the Windows copy covers losing the server; neither covers both
  machines dying in the same week. A cloud destination would.

### Contract with the infrastructure (for the user's Docker/Caddy setup)

- **One origin.** Caddy must route `/api/*` → API (`PORT`, default 3333) and everything else →
  the static web build (SPA: unknown paths fall back to `index.html`). The app relies on
  same-origin for cookies; no CORS is configured.
- **API runtime:** `node apps/api/dist/server.js` with env vars from `apps/api/.env.example`.
  The bundle inlines `@spendly/shared` but needs production `node_modules` (`@prisma/client`,
  `@prisma/adapter-pg`, `express`, …) — e.g. `pnpm --filter @spendly/api deploy --prod <dir>`.
- **Migrations:** run `prisma migrate deploy` (Prisma CLI is a devDependency of `apps/api`)
  before starting a new API version.
- **Health:** `GET /api/health` → `200 {status:"ok",database:"up"}` or `503` when the DB is down.
- **Proxy trust:** set `TRUST_PROXY` (default `loopback`) to match where Caddy runs — it decides
  `req.ip` (rate limiting) and `req.protocol` (Origin check).
- **HTTPS required in production:** the session cookie is `__Host-spendly_session`
  (`Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`); browsers drop it over plain HTTP.
- **`WEB_ORIGIN`** must be the public URL (e.g. `https://spendly.example.com`): writes from
  any other Origin get 403, and invite links are built from it.
- **Single API instance:** the login rate limiter keeps its counters in memory.

---

## Stack

| Layer    | Choice (version)                                                                                                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Monorepo | pnpm 11 workspaces (`apps/*`, `packages/*`)                                                                                                                                                                                                |
| Web      | React 19, Vite 8, TypeScript 6.0, Tailwind CSS 4 (CSS-first config), shadcn/ui patterns on Radix (`radix-ui`), React Router 8, TanStack Query 5, React Hook Form 7 + Zod 4, Recharts 3, lucide-react, sonner, read/write-excel-file (lazy) |
| API      | Node 24, Express 5, Prisma 7.10 (`prisma-client` generator + `@prisma/adapter-pg`), Zod 4, pino, helmet, cookie-parser, express-rate-limit, Argon2id (`@node-rs/argon2`); tests: Vitest + supertest + `@prisma/dev`                        |
| Shared   | `packages/shared` — TypeScript source consumed directly (money, dates, enums, Zod primitives, defaults)                                                                                                                                    |
| Tooling  | ESLint 10 flat config + typescript-eslint (type-checked) + jsx-a11y, Prettier 3 + Tailwind plugin, Vitest 5, tsup, tsx                                                                                                                     |

Not used on purpose: TanStack Table (v9's new API added nothing for a month-scoped grid filtered
on the server — the grid is hand-built), date-fns (shared calendar helpers cover it) and SheetJS
(npm's `xlsx` is stuck on the vulnerable 0.18.5; the maintained `read-excel-file` /
`write-excel-file` pair reads and writes .xlsx and is imported only when a file is chosen).

---

## Folder structure

```
.
├── CLAUDE.md                     ← you are here
├── package.json                  ← root scripts (dev, check, db:*)
├── pnpm-workspace.yaml           ← workspaces, allowed build scripts, @types hoisting
├── tsconfig.base.json            ← strict TS shared by all packages
├── eslint.config.js · prettier.config.js · .editorconfig · .nvmrc
├── .claude/launch.json           ← dev-server entry for Claude's browser preview
├── packages/shared/src
│   ├── money.ts                  ← formatBRL, formatMoneyParts, parseBRL, allocateCents (+ tests)
│   ├── dates.ts                  ← calendar-date & month helpers, addDays/addMonthsToDate (+ tests)
│   ├── invoices.ts               ← invoice engine: resolveInvoiceCycle/InstallmentCycle, invoiceStatus (+ tests)
│   ├── recurrence.ts             ← recurring dates: nthOccurrence, occurrencesBetween, nextOccurrence (+ tests)
│   ├── enums.ts                  ← domain enums + pt-BR labels (mirror of Prisma enums)
│   ├── palette.ts                ← tone keys (700 · 300 · 900 · 500 · neutral) + pt-BR labels
│   ├── category-icons.ts         ← icon keys allowed for categories
│   ├── schemas/                  ← Zod: primitives, auth, household, category, account, card, transaction, recurring,
│   │                               bill, import-export (+ tests)
│   ├── dto.ts                    ← response shapes (MeDto, AccountDto, CardDto, InvoiceSummaryDto…)
│   └── defaults/categories.ts    ← default pt-BR category tree
├── apps/api
│   ├── prisma.config.ts          ← Prisma 7 config (schema path, migrations, seed, datasource)
│   ├── prisma/schema.prisma      ← THE domain model
│   ├── prisma/migrations/        ← SQL migrations (init includes hand-written CHECK constraints)
│   ├── prisma/seed.ts            ← demo household (idempotent; SEED_RESET=true recreates)
│   ├── tsup.config.ts            ← bundles src/server.ts (+ @spendly/shared) to dist/
│   ├── vitest.config.ts          ← integration tests (global setup starts a test DB)
│   └── src
│       ├── server.ts · app.ts    ← bootstrap, middleware order, graceful shutdown
│       ├── config/env.ts         ← Zod-validated env (fails fast)
│       ├── routes/               ← auth, invites, household, categories, accounts, cards (+ invoices, card-purchases),
│       │                           transactions, recurring, bills, summary, import/export, health
│       ├── middleware/           ← auth (loadSession/require*/scopeOf), origin-check, rate-limit, error-handler
│       ├── domain/               ← services: auth, households, invites, categories, accounts, cards/ (card, invoice, purchase,
│       │                           payment), transactions/, recurring/ (lazy idempotent generation), bills/ (projection),
│       │                           summary/ (dashboard aggregates), import/ (preview, commit, match, export)
│       ├── lib/                  ← prisma, logger, http-error, password, tokens, params, db-dates, enum-parity
│       ├── types/express.d.ts    ← req.auth typing
│       ├── test/                 ← global-setup (test DB), helpers, *.test.ts per area
│       └── generated/prisma/     ← Prisma client (generated, gitignored)
└── apps/web
    ├── index.html                ← pre-paint theme script
    ├── vite.config.ts            ← @ alias, /api proxy
    └── src
        ├── main.tsx · app/       ← providers, router, loaders (guards), ProtectedLayout, navigation, error/404/boot screens
        ├── styles/index.css      ← Tailwind 4 theme mapping, `desk` breakpoint, base type, `.blueprint`, motion
        ├── styles/tokens/        ← planta.css ("Planta" light + `.dark` "Aço noturno")
        ├── components/ui/        ← primitives: button, card, input, form (Field/NativeSelect/Switch/ChoiceChips), badge, popover,
        │                           tooltip, sheet, dropdown-menu, confirm-dialog, segmented, toaster, misc
        ├── components/pickers/   ← ColorPicker, IconPicker
        ├── components/money/     ← Money, AmountInput
        ├── components/category/  ← CategoryBadge, CategoryIcon, icon registry, paletteStyle
        ├── components/data/      ← KpiGrid/KpiCell, Ruler, Donut, TrendBars (hand-drawn SVG/boxes)
        ├── components/month-picker/ · empty-state/ · member/ · layout/ (AppShell, AppHeader, Sidebar,
        │                           BottomNav + MoreSheet, BrandMark, PageHeader, nav-link-class)
        ├── features/             ← auth/, dashboard/ (api + panels/: Kpis, BudgetAlerts, CategorySpending, Trend,
        │                           UpcomingBills, CardsGlance, AccountsGlance, GettingStarted),
        │                           accounts/, cards/, categories/, settings/, household/ (api hooks),
        │                           transactions/ (grid, list, sheets, recurring), bills/ (list, calendar, pay), incomes/,
        │                           import/ (ImportPage, FilePicker, column parsing, ExportMenu),
        │                           command-palette/, quick-add/, placeholder/, design-showcase/ (+ its static demo-data)
        └── lib/                  ← api fetch, query client + keys, session-cache, form-errors, undo-toast, theme,
                                    privacy, month (MonthProvider), brand (APP_NAME), ledger (invalidateLedger),
                                    spreadsheet (CSV + lazy XLSX), storage, media queries, css colors
```

---

## Conventions (non-negotiable)

1. **Money = integer cents** (`Int`). Never floats. Format only at the edge with `formatBRL` /
   `<Money>`; parse user input with `parseBRL` / `<AmountInput>`. Split money with
   `allocateCents` (never loses a cent). Max per row: `MAX_CENTS` (R$ 21.474.836,47).
2. **Calendar dates are strings `YYYY-MM-DD`** in TS and `@db.Date` in Postgres. They are
   computed in `America/Sao_Paulo` at entry time (`todayIso()`) and never shifted. Months are
   `MonthKey` `"YYYY-MM"`. Convert to/from Prisma **only** via `toDbDate`/`fromDbDate`
   (`apps/api/src/lib/db-dates.ts`). Instants (`createdAt`, `expiresAt`) are `timestamptz`.
3. **Every business query is scoped by `householdId`**, taken from the session — never from the
   request body or URL. Child tables without `householdId` are reached only through a scoped
   parent.
4. **Derived numbers are never stored**: account balance, invoice total, invoice status,
   card available limit. Compute them from the ledger.
5. **Soft delete** user data that supports "Desfazer" (`deletedAt` on Transaction).
   Structural entities (categories, accounts, cards) are **archived** (`archivedAt`), never deleted
   while referenced (FKs are `NO ACTION`). Deleting a household goes through
   `deleteHouseholdData()` (leaves first) — never a bare `DELETE`.
6. **pt-BR UI / English code.** All user-visible copy is pt-BR; identifiers, comments, logs,
   commits are English. URLs are pt-BR slugs (`/lancamentos`, `/contas-a-pagar`).
7. **API errors:** `{ error: { code, message, details? } }` — `code` is a stable English
   identifier, `message` is pt-BR and safe to show. Throw `HttpError` helpers; Zod errors → 400
   with field details; Prisma `P2002` → 409, `P2025` → 404.
8. **Enums live in two places on purpose** (Prisma + `@spendly/shared/enums.ts`);
   `apps/api/src/lib/enum-parity.ts` fails `pnpm typecheck` if they drift.
9. **Colors are tone keys** (`700`, `300`, `900`, `500`, `neutral`) in the DB, never hex. Icons are
   icon keys.
10. **Design tokens only.** Components use semantic Tailwind classes (`bg-background`,
    `text-muted-foreground`, `bg-steel-100`, `bg-(--tint)`) — never raw hex. Money always via
    `<Money>`. Frames are `border` + `.blueprint`; corners stay square; no red/green.
11. **Accessibility:** never color alone (sign/icon/word alongside), keyboard reachable,
    44px touch targets on mobile, `prefers-reduced-motion` respected, every chart has a legend
    and a table view.
12. **Imports:** `@/…` alias in web; `import type` for types (lint-enforced).
13. **Scoping in code:** household routes are mounted behind `requireHousehold`; handlers get the
    scope with `scopeOf(req)` (and the user with `authOf(req)`). Services take `householdId` as
    their first argument and look rows up with `{ id, householdId }` — a foreign id is a 404.
14. **Validation:** parse bodies with the shared Zod schemas (`createCategorySchema.parse(req.body)`);
    the same schemas drive the web forms (`zodResolver`). Field-level API errors use
    `HttpError.field(path, message, status, code)` → `details: [{ path, message }]`, which
    `showFormError()` attaches to the matching input.
15. **Destructive actions** archive/soft-delete immediately and show `undoToast()` (6 s
    "Desfazer"); only irreversible deletes ask for confirmation (`ConfirmDialog`).
16. **Server state:** TanStack Query with keys from `lib/query-keys.ts`; mutations invalidate their
    prefix. After login/switch/accept use `replaceSession()`, after logout `endSessionCache()` —
    never `queryClient.clear()` (it detaches mounted screens).
17. **Everything is shared.** Expenses, incomes, accounts and cards belong to the couple; there are
    no splits and no debts between members. `paidById` is information ("pago por"); an
    account's/card's `holderId` only says whose name it is in.

---

## Domain model (apps/api/prisma/schema.prisma)

| Model             | Purpose / key rules                                                                                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`            | Login identity (email lowercased, Argon2id hash). Knows nothing about money.                                                                                                                                                                                                              |
| `Session`         | Server-side session; cookie holds a random token, DB stores its SHA-256 (`tokenHash`). Has `activeHouseholdId`.                                                                                                                                                                           |
| `Household`       | Tenant boundary (currency, timezone, locale).                                                                                                                                                                                                                                             |
| `HouseholdMember` | A user inside a household (`role` OWNER/MEMBER, `displayName`, `color` tone). **Money references members, not users.**                                                                                                                                                                    |
| `HouseholdInvite` | One-time invite (hash of token, expiry, accepted/revoked).                                                                                                                                                                                                                                |
| `Category`        | EXPENSE/INCOME, icon key, palette key, optional parent (one level), optional `monthlyBudgetCents`, `archivedAt`.                                                                                                                                                                          |
| `Account`         | CHECKING/SAVINGS/CASH/BENEFIT, `holderId` (null = joint). Balance = `initialBalanceCents` + PAID movements dated ≥ `initialBalanceDate`.                                                                                                                                                  |
| `CreditCard`      | `limitCents`, `closingDay`, `dueDay` (1–31, clamped), `paymentAccountId`, `holderId` (null = shared).                                                                                                                                                                                     |
| `Invoice`         | One per card per cycle: `referenceMonth` (1st of **due** month), `periodStart` (incl.), `closingDate` (excl.), `dueDate`. Dates are a **snapshot**. No total/status columns.                                                                                                              |
| `Transaction`     | The single ledger. `type` EXPENSE/INCOME/TRANSFER, `status` PAID/PENDING, `amountCents > 0`, `date` (competence), `dueDate` (bills), `paidDate`, links to category/account/toAccount/card/invoice, `paidById` (who paid — information only), installment & recurrence links, `deletedAt`. |
| `InstallmentPlan` | Parent of "R$ 1.200 em 6x"; children are Transactions with `installmentNumber`.                                                                                                                                                                                                           |
| `RecurringRule`   | Rent/subscriptions/salary; anchor `startDate`, `frequency`, `interval`, `autoConfirm`, `generatedUntil`.                                                                                                                                                                                  |
| `Tag`             | Free-form labels (m2m with Transaction).                                                                                                                                                                                                                                                  |

### Ledger row shapes (enforced by CHECK constraints in the init migration)

| Movement                             | Columns                                                            |
| ------------------------------------ | ------------------------------------------------------------------ |
| Expense/income on an account         | `type` EXPENSE/INCOME, `accountId`                                 |
| Card purchase / card credit (refund) | `type` EXPENSE/INCOME, `creditCardId` + `invoiceId`                |
| Transfer between accounts            | `type` TRANSFER, `accountId` (from) + `toAccountId` (to)           |
| Invoice payment                      | `type` TRANSFER, `accountId` (from) + `creditCardId` + `invoiceId` |
| Pending bill without account yet     | `type` EXPENSE, `status` PENDING, `dueDate`, no account/card       |

Other CHECKs: positive amounts, card days 1–31, installment pair consistency,
`occurrenceDate` required with a rule, distinct transfer accounts, `installmentCount` 2–120. **Prisma cannot express CHECKs**: when a future
migration recreates a table, re-add them by hand.

### Derived values (formulas)

- **Account balance** = `initialBalanceCents` + Σ PAID (INCOME + TRANSFER in) − Σ PAID (EXPENSE + TRANSFER out), dated ≥ `initialBalanceDate`, `deletedAt IS NULL`.
- **Invoice total** = Σ EXPENSE − Σ INCOME (credits) with that `invoiceId`. **Paid** = Σ PAID TRANSFER with that `invoiceId`.
- **Invoice status** (`today` in São Paulo): `paid` if paid ≥ total > 0 · `partially_paid` if 0 < paid < total and today ≤ due · `overdue` if today > due and paid < total · `closed` if today ≥ closingDate · else `open`.
- **Card available limit** = `limitCents` − (Σ card purchases − Σ card credits − Σ invoice payments) over all non-deleted rows (future installments consume limit up front, like Brazilian banks).

### Invoice assignment rule (Phase 2 implements this; tests must cover every edge case)

```text
// All inputs are calendar dates (YYYY-MM-DD) in America/Sao_Paulo.
clampDay(y, m, d)      = date(y, m, min(d, daysInMonth(y, m)))
closingOf(y, m, card)  = clampDay(y, m, card.closingDay)

function cycleFor(purchaseDate, card):
    inv = findInvoice(card, periodStart ≤ purchaseDate < closingDate)    // snapshot wins
    if inv: return inv
    c = closingOf(purchaseDate.y, purchaseDate.m, card)
    if purchaseDate >= c: c = closingOf(nextMonth(purchaseDate), card)    // ON closing day → next
    due = clampDay(c.y, c.m, card.dueDay)
    if due <= c: due = clampDay(nextMonth(c), card.dueDay)                // first dueDay after closing
    start = max(closingOf(prevMonth(c), card), latestInvoiceBefore(card, c)?.closingDate)
    return upsertInvoice(card, referenceMonth = firstOfMonth(due), start, c, due)

function installmentCycle(purchaseDate, card, k):   // k = 0..n-1
    base = cycleFor(purchaseDate, card)
    c_k  = closingOf(addMonths(base.closingDate, k), card)   // shift the CYCLE, not the date
```

| Card              | Purchase                                | Result                                                 |
| ----------------- | --------------------------------------- | ------------------------------------------------------ |
| closes 31, due 10 | 27/02/2027                              | closes 28/02 (clamped), due 10/03                      |
| closes 31, due 10 | 28/02/2027 (= clamped closing)          | next cycle: closes 31/03, due 10/04                    |
| closes 31, due 10 | 28/02/2028 (leap)                       | closes 29/02, due 10/03                                |
| closes 25, due 5  | 24/10                                   | closes 25/10, due 05/11 ("fatura de novembro")         |
| closes 25, due 5  | 25/10 (exactly closing)                 | closes 25/11, due 05/12                                |
| closes 5, due 15  | 03/10                                   | closes 05/10, due 15/10                                |
| any               | 23:50 in São Paulo on 24/10             | date is 24/10                                          |
| any               | late entry into an already-paid invoice | stays there → invoice becomes partially paid + warning |

Not modeled yet: due dates moved to the next business day, revolving credit/interest,
refunds (estornos) UX — decide in Phase 2.

Installments: installment _k_ has `date = purchaseDate + k months` (clamped) for competence
reports and `invoiceId` of cycle _k_. Amounts come from `allocateCents` with equal weights: the
extra cents of an uneven split go one each to the **first** installments (R$ 100,00 in 3x =
33,34 + 33,33 + 33,33). Refunds (estornos) are card credits (`INCOME` rows on the card) that
land on the invoice of their date and lower its total; they are never split.

When the closing day changes, existing invoices keep their dates; a new cycle starts where the
last one closed, and if its due month already has an invoice that closed before the purchase,
the purchase rolls to the next cycle (one invoice per card per due month).

---

## Integration rules (what makes the app useful)

1. A credit-card purchase is automatically assigned to the right invoice (purchase date vs closing day — rule above).
2. Each invoice shows up automatically in "Contas a pagar" on its due date (the projection reads unpaid invoices; nothing is copied).
3. Paying an invoice creates a TRANSFER from the linked account → updates the account balance and frees the card limit. Partial payments are allowed; paying more than what is left is refused (`OVERPAYMENT`). Undo = soft-delete that one row.
4. Recurring rules feed both the monthly forecast and "Contas a pagar" (PENDING occurrences, idempotent per `occurrenceDate`). Generation is lazy: listing transactions/rules/cards materializes account occurrences up to the end of next month (or the month being viewed, max 12 months ahead), card subscriptions once their day arrives, and turns auto-confirmed ones PAID on their day.
5. Category budgets compare against real spending in real time and raise dashboard alerts at **80%** and **100%** (`BUDGET_ALERT_THRESHOLDS_BPS`).
6. The dashboard is fully clickable: category slice, card, member or month → transactions grid pre-filtered.
7. "Pago por": every expense/income records who paid or received it — information for the couple, never a debt (everything is shared).
8. Create anything inline: typing a category/card that doesn't exist offers **Criar "X"** in place — never leave the flow (pattern already in `QuickAddForm`).

---

## API (Phases 1–6)

All JSON under `/api`. Writes require our Origin (or no browser Origin at all). 🔒 = session,
🏠 = active household, 👑 = household owner, ⏱ = rate-limited.

| Method & path                                                                                      | Auth               | Purpose                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                                                                                      | —                  | Liveness + DB probe                                                                                                                                                                                                     |
| `POST /auth/register`                                                                              | ⏱                  | Create user + household (default categories), or join one with `inviteToken`; starts session                                                                                                                            |
| `POST /auth/login` · `POST /auth/logout`                                                           | ⏱ · —              | Session start (fresh token) / end (server-side)                                                                                                                                                                         |
| `POST /auth/change-password`                                                                       | 🔒⏱                | New password after checking the current one; every **other** session of that user is dropped                                                                                                                            |
| `GET /auth/me`                                                                                     | 🔒                 | `MeDto`: user, active household, members, memberships                                                                                                                                                                   |
| `POST /auth/switch-household`                                                                      | 🔒                 | Change the session's active household                                                                                                                                                                                   |
| `GET /invites/:token` · `POST /invites/:token/accept`                                              | ⏱ · 🔒⏱            | Public invite preview · accept (e-mail must match)                                                                                                                                                                      |
| `PATCH /household`                                                                                 | 🏠👑               | Household name                                                                                                                                                                                                          |
| `PATCH /household/members/me`                                                                      | 🏠                 | Own display name & colour (distinct per household)                                                                                                                                                                      |
| `GET/POST /household/invites` · `DELETE /household/invites/:id`                                    | 🏠 (👑 for writes) | Pending invites; create (link shown once, 7 days); revoke                                                                                                                                                               |
| `GET/POST /categories` · `PATCH /categories/:id`                                                   | 🏠                 | List (`?includeArchived=true`), create, edit                                                                                                                                                                            |
| `POST /categories/:id/archive` · `/unarchive` · `DELETE /categories/:id`                           | 🏠                 | Archive cascades to children; delete only if unused                                                                                                                                                                     |
| `GET/POST /accounts` · `PATCH /accounts/:id`                                                       | 🏠                 | List with derived `balanceCents`, create, edit                                                                                                                                                                          |
| `POST /accounts/:id/archive` · `/unarchive` · `DELETE /accounts/:id`                               | 🏠                 | Delete only if no movements/rules                                                                                                                                                                                       |
| `GET/POST /cards` · `GET/PATCH /cards/:id`                                                         | 🏠                 | Cards with derived `usedCents`/`availableCents` and `currentInvoice`; closing/due day edits only affect new invoices                                                                                                    |
| `POST /cards/:id/archive` · `/unarchive` · `DELETE /cards/:id`                                     | 🏠                 | Archived cards refuse purchases; delete only if unused                                                                                                                                                                  |
| `GET /cards/:id/invoices` · `GET /invoices/:id`                                                    | 🏠                 | Invoice timeline (future installments included) · invoice detail with its items                                                                                                                                         |
| `POST /card-purchases`                                                                             | 🏠                 | Purchase or refund; `installments` 1–24 → plan + one row per installment; warns on a paid invoice                                                                                                                       |
| `PATCH/DELETE /card-purchases/:id?scope=one\|following\|all` · `POST /card-purchases/restore`      | 🏠                 | Edit text/category/paid-by · soft delete (returns ids) · "Desfazer"                                                                                                                                                     |
| `GET /transactions?month=&kind=&categoryId=&accountId=&creditCardId=&paidById=&q=`                 | 🏠                 | Month rows (account + card) with totals; a parent category matches its children                                                                                                                                         |
| `POST /transactions` · `PATCH /transactions/:id`                                                   | 🏠                 | Expense / income / transfer on accounts; pending bills with due date; mark paid (paidDate) · card rows only take text edits (`CARD_ROW_LOCKED`)                                                                         |
| `DELETE /transactions/:id?scope=` · `POST /transactions/restore`                                   | 🏠                 | Soft delete (installments honour the scope) · "Desfazer"                                                                                                                                                                |
| `GET/POST /recurring-rules` · `PATCH /recurring-rules/:id` · `POST …/pause` · `/resume` · `DELETE` | 🏠                 | Rules on an account (pending occurrences) or card (purchases); edits hit pending occurrences from today on; delete keeps paid history                                                                                   |
| `GET /bills?month=`                                                                                | 🏠                 | "Contas a pagar" as a projection: pending rows with a due date + unpaid invoices up to the end of that month (earlier overdue always included), bucketed overdue/today/week/later, with totals and what is already paid |
| `POST /bills/:id/pay`                                                                              | 🏠                 | Confirms a pending row: account + paid date (undo = back to PENDING)                                                                                                                                                    |
| `POST /invoices/:id/payments`                                                                      | 🏠                 | Pays (part of) an invoice: a TRANSFER account → invoice; refuses `OVERPAYMENT`, `INVOICE_PAID`, `INVOICE_EMPTY`                                                                                                         |
| `GET /summary?month=`                                                                              | 🏠                 | The whole dashboard in one request: spending by category (children rolled up, share and budget usage), income × expense for the last 6 months, month totals and budget alerts at 80% / 100%                             |
| `POST /import/preview`                                                                             | 🏠                 | Reads statement rows (JSON, never the file): guesses each category from how the household filed that shop before, and flags lines whose day + amount are already in the ledger. Writes nothing                          |
| `POST /import/commit` · `POST /import/undo`                                                        | 🏠                 | Writes the confirmed lines in one transaction (card rows land on the invoice of their date) and returns their ids · soft-deletes them again for "Desfazer"                                                              |
| `GET /export?from=&to=`                                                                            | 🏠                 | The ledger over a window with names instead of ids and signed amounts, ready to become a spreadsheet                                                                                                                    |

Auth details: Argon2id passwords (8–128 chars); unknown e-mails are verified against a dummy
hash (same timing); sessions last 30 days, slide forward at most once a day, and are deleted on
logout and expiry; every login issues a new token (no session fixation).

---

## Design system — "Casa" on Industry

Source: the Claude Design handoff (`Casa App.dc.html` + the **Industry** design system). Not a
pixel copy — the palette, flow, motion and drawing rules are what we follow.

**The idea:** a technical drawing. Steel-blue on a light technical ground, Barlow Condensed
headings over Barlow, a visible grid, and cards / figures / the primary button framed as
**blueprint objects** — square corners, 1px hairlines, "+" registration marks on the corners.
Cards are line drawings (no fill); the primary button is the one solid object on the board.

| Direction                         | When                | Ground · ink · accent                                         |
| --------------------------------- | ------------------- | ------------------------------------------------------------- |
| **A — "Planta"** (default, light) | `:root` / `.light`  | `#f2f2f3` · `#1d1f20` · steel `#5980a6` (text-safe `#4a7096`) |
| **B — "Aço noturno"** (dark mode) | `.dark` on `<html>` | `#14181c` · `#e6e8ea` · steel `#8fb3d6`                       |

Only the light/dark **mode** is a user choice (light/dark/system, `localStorage` key
`spendly.theme`, applied pre-paint by `index.html`). There is no "direction" switch any more.
Tokens live in `apps/web/src/styles/tokens/planta.css`; `.light` / `.dark` classes also scope
them to a subtree (the showcase previews both directions side by side).

**Colour rules**

- **Mono scheme:** ground, ink and **one** accent (steel), each with a 100–900 ramp of equal
  visual weight (`--steel-100…900`, `--graphite-100…900`; ramps invert in dark so 100 is always
  the quiet tint). Use 100–300 for washes, 500 for the base, 700–900 for text on washes.
- **No green / red.** Income = "+" and ↗ in steel-700 (`text-positive`); expense = "−" and ↘ in
  ink; problems = ink outline + icon + word ("Atrasada"); "vence logo" = deep steel tag. Meaning
  is never carried by colour alone.
- **Tones (categories, accounts, people):** keys `700 · 300 · 900 · 500 · neutral` (auto-assign
  in that order; `neutral` = graphite, for "Outros"). The DB stores the key; `paletteStyle(key)`
  exposes `--tint`, `--tint-fg`, `--tint-soft`, `--tint-ink`. With one accent the **icon** is
  what tells categories apart — always show it.
- **The one dark field** `--emphasis` (steel-900): login panel, toasts, tooltips.
- Accent on ground is ≥ 3:1 (marks, icons, large text); body-size steel text uses
  `--primary` / steel-700. `--muted-foreground` is darkened to `#5f6062` for 4.5:1.

**Type:** Barlow Condensed 600 for headings and big numbers (h1 42 · h2 32 · h3 25 · h4 20,
tracking −0.015em); Barlow 15/1.55 for UI; tabular figures everywhere. Small labels use
`.kicker` (10.5px uppercase, 0.1em). Fonts self-hosted via `@fontsource/barlow(-condensed)`.

**Shape:** radius 0 everywhere; 1px hairlines (`--border` = ink 16%); `.blueprint` utility draws
the four 11px "+" marks on `::after` (pair it with `border`; never on a clipping element — wrap
scroll areas, and make scroll containers `relative` so `sr-only` text stays inside). Shadows only
on what floats: dialogs/sheets/popovers (`shadow-raised`/`shadow-overlay`), toasts, the mobile FAB.
Lucide icons at stroke 1.5 (global CSS). Hover = ink/steel wash 6–10%; focus = 2px steel outline.

**Motion:** precise, no bounce. 120–180ms colour transitions; dialogs fade + rise 12–16px in
220ms (`ease-out-soft`); popovers fade + 4px; page content fades in (`animate-page-in`, keyed by
route); rulers grow from the left (`animate-grow-x`). `prefers-reduced-motion` stops all of it.

**Layout (from the prototype):** breakpoint **`desk` = 900px**.

- ≥ 900px: 252px sidebar (brand + household, groups **Visão / Registro / Cadastros**, footer
  with "Saldo nas contas", people, Sair + privacy/theme) · sticky header with the page title
  (the page's `<h1>`), the shared **month picker** (monthly screens only), "Lançar ou buscar ·
  Ctrl K" and the primary "+ Lançamento" · content fills the width (no cap — it used to be
  1400px, which left a gap beside the full-width header on big screens), 28px rhythm.
- < 900px: sticky header (title, privacy, "Mais" sheet; the month picker drops to its own row) ·
  fixed 66px bottom bar: Painel, Lançar, **square + FAB**, Cartões, A pagar.
- The month lives in `MonthProvider` (`useMonth()`), so switching screens keeps the month.

### Tokens (CSS variables → Tailwind utilities)

| Group     | Variables                                                                                         | Utilities                                                |
| --------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Ramps     | `--steel-100…900`, `--graphite-100…900`, `--steel`                                                | `bg-steel-100`, `text-steel-700`, `border-steel`…        |
| Surfaces  | `--background --surface --surface-raised --surface-sunken --muted`                                | `bg-background`, `bg-surface-sunken` (inputs)…           |
| Ink       | `--foreground --muted-foreground --subtle-foreground`                                             | `text-foreground`, `text-muted-foreground`…              |
| Lines     | `--border --border-strong --input --ring --mark`                                                  | `border-border`, `outline-ring`…                         |
| Brand     | `--primary(-hover/-pressed/-foreground/-soft/-soft-foreground)`, `--emphasis(-foreground/-muted)` | `bg-primary`, `bg-emphasis`…                             |
| Meaning   | `--positive --negative --warning --info` (+ `-soft`) — steel/ink only                             | `text-positive`…                                         |
| Type      | `--typeface-ui --typeface-display --typeface-numeric --display-weight --display-tracking`         | `font-sans`, `font-display`, `font-money`, `.kicker`     |
| Shape     | `--r-*` (all 0), `--control-h` (36px, 44px on touch), `--row-h`                                   | `h-(--control-h)`, `.blueprint`                          |
| Elevation | `--elevation-1` (none) / `-2` / `-3`                                                              | `shadow-raised`, `shadow-overlay`                        |
| Tones     | `--palette-{700,300,900,500,neutral}` + `-fg`, `--tone-ink`                                       | `paletteStyle(key)` → `bg-(--tint)`, `text-(--tint-fg)`… |
| Motion    | `--ease-out-soft --ease-in-soft`, `animate-page-in / rise-in / grow-x / grow-y / shimmer`         | `ease-out-soft`, `animate-rise-in`…                      |

**Chart rules:** straight marks (no rounding), ink baseline, 1px hairline grid, text in text
tokens (never series colour), tones + icon + direct labels, legend for ≥ 2 series, hover tooltip,
table view, animations off with reduced motion, clean ticks (multiples of R$ 5.000 etc.). Donut =
168px, r 62, 16px ring, 2px gaps, total in the middle; bars: income outlined, expense steel-700,
current month steel-900. Recharts needs real colours → `useCssColors`; hand-drawn SVG can use
`var(--…)` directly.

### Core components

| Component                        | Notes                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Money`                          | sizes sm/md (Barlow) and lg/xl/hero (condensed, quieter "R$"), `flow` in/out, `signed`, `compact`, privacy-aware, screen-reader text, no red                                                                                                                                                                                                                |
| `AmountInput`                    | right-to-left "maquininha" entry; `hero` = 48px condensed digits on an ink underline (quick add)                                                                                                                                                                                                                                                            |
| `CategoryBadge` / `CategoryIcon` | square tone tile + icon (+ name); variants soft/outline/plain                                                                                                                                                                                                                                                                                               |
| `MonthPicker`                    | hairline box: ← "Out 2026" →, the label opens a ruled 3×4 month grid; keyboard navigation                                                                                                                                                                                                                                                                   |
| `KpiGrid` / `KpiCell`            | headline numbers in equal cells separated by 1px rules; optional drill-down; `emphasis` cell on the steel wash (forecast)                                                                                                                                                                                                                                   |
| `Ruler`                          | budget/limit meter: hairline box, steel fill, ink tick at 80%, deepest steel past 100%                                                                                                                                                                                                                                                                      |
| `EmptyState`                     | thin steel icon, condensed title, one sentence, next action                                                                                                                                                                                                                                                                                                 |
| Shell                            | `AppShell`, `AppHeader`, `Sidebar`, `BottomNav` + `MoreSheet`, `BrandMark`/`HouseGlyph`, `PageHeader` (description + actions; title is in the header)                                                                                                                                                                                                       |
| UI primitives                    | Button (primary = blueprint solid; secondary, ghost = steel text, quiet, soft, destructive = ink, link), Card (blueprint), Input/Label, Badge (square tags), Segmented (ruled cells, `fill`), Sheet (bottom/right/center), Popover, DropdownMenu, Tooltip (emphasis), Toaster (emphasis, 6 s, outlined "Desfazer"), ConfirmDialog, Skeleton, Kbd, Separator |
| Pickers / form                   | `ColorPicker` (square tone swatches), `IconPicker`, `Field`, `NativeSelect`, `Switch` (square), `ChoiceChips` (steel frame + wash when chosen)                                                                                                                                                                                                              |
| Patterns                         | Quick add dialog (amount → category search/"Criar" → description → conta/cartão → "Pago por" → Salvar, Enter saves); showcase: KPI strip, próximas contas (date boxes), cartões, lançamentos table with sticky total                                                                                                                                        |

---

## Glossary (banana-simple)

| Concept                       | Analogy                                                             | Technical                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Integer cents                 | Count coins, not "1.1 reais"                                        | Store `1234` for R$ 12,34 in an `Int`; floats can't represent 0.1 exactly                                               |
| Calendar date vs instant      | A birthday is the same everywhere; a meeting at 14:00 UTC isn't     | `@db.Date` for business dates, `timestamptz` for moments                                                                |
| Derived, never stored         | Add up the statement instead of trusting a sticky note              | Balances/totals computed from the ledger — one source of truth                                                          |
| Soft delete                   | Trash can, not shredder                                             | `deletedAt` timestamp; undo = clear it                                                                                  |
| Idempotency                   | Pressing the elevator button 5× calls it once                       | Unique `(recurringRuleId, occurrenceDate)` makes generation safe to repeat                                              |
| Basis points                  | Cut the pizza in 10.000 slices                                      | `5000` = 50%; integer percentages                                                                                       |
| CHECK constraint              | A bouncer at the database door                                      | SQL rule rejecting invalid rows even if the app has a bug                                                               |
| UUID v7                       | Serial numbers that also say when they were printed                 | Time-ordered, index-friendly, unguessable ids                                                                           |
| Session token hash            | The coat-check keeps a photo of your ticket, not the ticket         | Cookie holds a random token; DB stores only its SHA-256                                                                 |
| Same-origin proxy             | One front door for the whole house                                  | Browser only talks to the web origin; `/api` is forwarded, so cookies just work and CORS isn't needed                   |
| Source-only workspace package | A shared recipe card, not a pre-baked cake                          | `@spendly/shared` ships TS; Vite/tsx/tsup compile it inside each app                                                    |
| Design tokens                 | Paint names on the cans, not the colors themselves                  | Components use `--surface`; themes redefine the variable                                                                |
| httpOnly cookie               | A wristband staff can read but you can't take off and lend          | Sent automatically, invisible to page JavaScript → XSS can't steal the session                                          |
| SameSite=Lax                  | The wristband only works at this club's door                        | Browser won't attach the cookie to cross-site POST/PUT/DELETE                                                           |
| CSRF + Origin check           | The bank asks "which branch is this check from?"                    | Writes are rejected unless the `Origin` header is our own site                                                          |
| Rate limiting                 | The ATM makes you wait after too many wrong PINs                    | N attempts per IP per window on login/register/invite, then HTTP 429                                                    |
| Argon2id + salt               | Keep a fingerprint, never the password — with a pinch of salt each  | Slow, memory-hard hash; equal passwords hash differently                                                                |
| Timing-safe login             | A bouncer who takes the same time whether or not you're on the list | Unknown e-mails are checked against a dummy hash, so timing reveals nothing                                             |
| Integration test              | Turn the whole clock on and check it tells time                     | Real HTTP requests against the real app and a real Postgres; tables wiped between tests                                 |
| Route loader (guard)          | A receptionist checks your badge before you reach the office        | React Router loader redirects to `/entrar` before a protected screen renders                                            |
| Query invalidation            | Crossing an item off the list so someone re-checks the shelf        | After a mutation, TanStack Query marks cached data stale and refetches it                                               |
| Shared money model            | One wallet on the kitchen table, not two piggy banks                | No splits or debts between members; `paidById` only records who paid                                                    |
| Tonal ramp                    | One paint, mixed with more or less white                            | `--steel-100…900`: same hue, steps of equal perceived lightness (OKLCH); 100 = wash, 900 = ink                          |
| Registration marks            | The "+" crosshairs printers use to line up sheets                   | `.blueprint` draws four 11px crosses on `::after` at the corners of a 1px frame                                         |
| Breakpoint                    | The width where the furniture gets rearranged                       | `desk` = 900px: sidebar + header actions above it, bottom bar + FAB below                                               |
| React context                 | A notice on the fridge everyone in the house can read               | `MonthProvider` holds the month once; any screen reads it with `useMonth()`                                             |
| Containing block              | The frame a sticker is measured from                                | An `absolute` element positions against its nearest positioned ancestor — scroll boxes must be `relative` or it escapes |
| Column mapping                | Telling the app which column of the bank's sheet is which           | The file's own headers are guessed first, then the shape of the first line; the person can correct any of it            |
| Byte order mark (BOM)         | A sticker on the envelope saying which alphabet is inside           | Three bytes at the start of a CSV that tell Excel to read it as UTF-8 instead of mangling the accents                   |
| Lazy route                    | Only unpacking the box for the room you walk into                   | `lazy: () => import(...)` gives each screen its own file, fetched when it is opened                                     |
| Accessible name               | The name a screen reader says out loud for a control                | A `<label>` only names real form controls — a `<button role="switch">` needs `aria-labelledby`                          |

---

## Decisions log

| Date       | Decision                                                                                                                             | Why                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 2026-10-03 | ~~Design direction **A "Terracota"** default, **B "Grafite"** alternate~~ (superseded 2026-10-04)                                    | Warm & personal for a couple's daily app; tokens make switching a one-attribute change                           |
| 2026-10-03 | Category palette re-stepped & re-ordered after running the dataviz validator (replaced by tones 2026-10-04)                          | The first earthy palette failed chroma and CVD checks (ΔE 1.7 protan)                                            |
| 2026-10-03 | Store **palette/icon keys**, not hex/component names                                                                                 | Colors adapt to theme & mode; data stays portable                                                                |
| 2026-10-03 | **pnpm 11** workspaces; `allowBuilds` for prisma/esbuild; `publicHoistPattern: @types/*`                                             | pnpm 11 blocks dependency scripts by default; react-router's types need `@types/react` resolvable from the store |
| 2026-10-03 | **TypeScript 6.0** (not 7)                                                                                                           | typescript-eslint 8.71 supports `<6.1`                                                                           |
| 2026-10-03 | **Prisma 7.10** (Prisma 8 is still RC); `prisma-client` generator, driver adapter `@prisma/adapter-pg`, config in `prisma.config.ts` | Latest stable; Rust-free client bundles cleanly                                                                  |
| 2026-10-03 | Default Prisma naming (PascalCase tables, camelCase columns)                                                                         | Less schema noise; raw SQL just quotes identifiers                                                               |
| 2026-10-03 | Members (not users) own money rows                                                                                                   | History survives membership changes; multi-household-ready                                                       |
| 2026-10-03 | Single ledger table; invoice payment = TRANSFER account → invoice                                                                    | Balances are one SUM over one table                                                                              |
| 2026-10-03 | Bills are a **projection** (pending + dueDate, unpaid invoices), not a table                                                         | Avoid duplicated state                                                                                           |
| 2026-10-03 | Invoice dates are a **snapshot**; status/total derived                                                                               | Changing closing day never rewrites history; no drift                                                            |
| 2026-10-03 | Purchases **on** the closing day go to the **next** invoice; invoices named by **due month**                                         | Brazilian "melhor dia de compra" convention (Nubank)                                                             |
| 2026-10-03 | ~~Splits always materialized; `paidById = null` = joint funds~~ (superseded 2026-10-04)                                              | Who-owes-whom is one formula                                                                                     |
| 2026-10-03 | App-level `householdId` scoping; composite `(householdId,id)` FKs **rejected**                                                       | Postgres `SET NULL` would null `householdId`; Prisma ergonomics                                                  |
| 2026-10-03 | `NO ACTION` FKs + archive; household deletion via ordered `deleteHouseholdData()`                                                    | Postgres checks NO ACTION per cascade step — a bare household DELETE fails                                       |
| 2026-10-03 | CHECK constraints hand-written in the init migration                                                                                 | Prisma can't express them; DB-level safety net                                                                   |
| 2026-10-03 | Sessions in a table (opaque token, hashed) over JWT — to implement in Phase 1                                                        | Revocable, simple, small                                                                                         |
| 2026-10-03 | Same-origin `/api` (Vite proxy in dev, Caddy in prod); no CORS                                                                       | Cookies + SameSite work without CORS/CSRF token complexity                                                       |
| 2026-10-03 | `@spendly/shared` is source-only; API bundled with **tsup** (`noExternal`)                                                           | No build step for shared; Node can't run TS from node_modules                                                    |
| 2026-10-03 | API error messages in pt-BR + stable English `code`                                                                                  | Two-person app: show server messages directly; code for logic/logs                                               |
| 2026-10-03 | Env loading via `process.loadEnvFile` (no dotenv)                                                                                    | Node 24 built-in; production uses real env vars                                                                  |
| 2026-10-03 | Fonts self-hosted via Fontsource (no Google Fonts CDN)                                                                               | Privacy, offline-friendly, no third-party requests                                                               |
| 2026-10-03 | AmountInput uses right-to-left ("maquininha") entry with numeric keypad                                                              | Fastest one-thumb entry; no comma hunting                                                                        |
| 2026-10-03 | "Ocultar valores" privacy toggle in Phase 0                                                                                          | Finance app used in public on mobile                                                                             |
| 2026-10-03 | Design showcase route is lazy-loaded                                                                                                 | Keeps Recharts out of the shell bundle                                                                           |
| 2026-10-03 | Session cookie `__Host-spendly_session` (prod) · httpOnly · SameSite=Lax · 30-day sliding expiry (refreshed ≤ 1×/day)                | Revocable sessions with few writes; `__Host-` blocks subdomain cookie injection                                  |
| 2026-10-03 | CSRF defense = SameSite=Lax + Origin/Referer check on writes (no CSRF token)                                                         | Same-origin app, JSON-only bodies; browsers send Origin on every write                                           |
| 2026-10-03 | Login/register/accept limited to `AUTH_RATE_LIMIT` (20) per IP / 15 min, in memory                                                   | Single API process; use a shared store if it ever scales out                                                     |
| 2026-10-03 | Invites: link shown **once**, 7-day expiry, newer invite revokes older ones, accepting requires the invited e-mail                   | Leaked links are useless to strangers; no e-mail infrastructure needed (share via WhatsApp)                      |
| 2026-10-03 | Registering through an invite joins that household instead of creating one                                                           | The partner shouldn't get an empty extra household                                                               |
| 2026-10-03 | Login opens the most recently used household; multi-household users switch from the sidebar chip                                     | Multi-household-ready without extra UI for the couple case                                                       |
| 2026-10-03 | Owner-only: rename household, create/revoke invites; each member edits own name/colour (colours unique)                              | Simple roles for two people                                                                                      |
| 2026-10-03 | ~~`Household.defaultSplitMode`~~ (migration `20261004000000_household_defaults`; removed 2026-10-04)                                 | "Defaults" in Settings; quick add pre-selects it                                                                 |
| 2026-10-03 | Archiving a parent category archives its children; restoring it restores them; a child can't be restored under an archived parent    | Keeps the tree consistent; undo is symmetric                                                                     |
| 2026-10-03 | Sibling category names and active account names unique (case-insensitive), enforced in services                                      | Avoid confusing duplicates; nullable parents make a DB unique index awkward                                      |
| 2026-10-03 | Account balances computed in one SQL aggregate (`movementsByAccount`)                                                                | One round trip for the list; the formula lives in one place                                                      |
| 2026-10-03 | API integration tests use an in-process Prisma dev server (PGlite) by default; `TEST_DATABASE_URL` for real Postgres                 | `pnpm test` works on a fresh clone with no Docker                                                                |
| 2026-10-03 | Route guards via React Router loaders + `ProtectedLayout` reacting to 401s                                                           | Redirect before render; mid-session expiry also lands on login with `?next=`                                     |
| 2026-10-03 | Sheets mount their form only while open                                                                                              | Fresh defaults each time; no reset effects or stale state                                                        |
| 2026-10-03 | Undo toasts last 8 s (6 s since 2026-10-04)                                                                                          | The 4 s default proved too short to reach "Desfazer"                                                             |
| 2026-10-03 | Quick add uses real categories/accounts/members; inline "Criar" persists categories                                                  | Integration rule 8 is real from Phase 1; transactions arrive in Phase 3                                          |
| 2026-10-04 | **Everything is shared**: removed splits, who-owes-whom, settlements and the default split; `paidById` kept as information           | The couple's bills are always "ours", never "mine" and "hers" (user decision)                                    |
| 2026-10-04 | Account/card `holderId` kept                                                                                                         | Whose name a bank account or card is in is still useful information                                              |
| 2026-10-04 | Design system **"Casa" on Industry** (Claude Design handoff) replaces Terracota/Grafite; only light/dark mode remains                | User chose the handoff design for the whole project                                                              |
| 2026-10-04 | UI brand is **"Casa"** (`APP_NAME`); repo, packages and storage keys keep `spendly`                                                  | Matches the design without churning code, env and cookies                                                        |
| 2026-10-04 | Palette = tones `700/300/900/500/neutral`; data migrated in SQL                                                                      | One accent: tones + icons replace nine hues; keys keep the DB theme-agnostic                                     |
| 2026-10-04 | Primary fill `#4a7096` (design's `#5980a6` kept for marks/lines/focus); muted text `#5f6062`                                         | ≥ 4.5:1 for button text and secondary copy                                                                       |
| 2026-10-04 | No red/green: income steel-700 "+ ↗", expenses ink "− ↘", problems = ink frame + icon + word                                         | The design's mono scheme; meaning never relies on colour                                                         |
| 2026-10-04 | `desk` breakpoint 900px; month picker in the header backed by `MonthProvider`                                                        | Prototype layout; the month follows you across screens                                                           |
| 2026-10-04 | Quick add = blueprint dialog (bottom-docked on phones) with "Pago por"; Enter saves, Esc closes                                      | Prototype flow; five-second entry                                                                                |
| 2026-10-04 | Toasts on the emphasis field, 6 s (supersedes 8 s)                                                                                   | Prototype timing; still long enough to reach "Desfazer"                                                          |
| 2026-10-04 | Motion: 120–220ms, fade + small rise, rulers grow; spring "pop" removed                                                              | A technical drawing should feel precise, not bouncy                                                              |
| 2026-10-04 | `.blueprint` as a Tailwind `@utility` on `::after`; `:where(.blueprint)` sets `position: relative` at zero specificity               | No extra markup; `fixed`/`sticky` utilities still win                                                            |
| 2026-10-04 | Fonts `@fontsource/barlow` + `@fontsource/barlow-condensed` (400–700 / 500–600)                                                      | Self-hosted like before; Fraunces/Manrope/Geist removed                                                          |
| 2026-10-04 | Installment split via `allocateCents` (extra cents one each to the first installments); refunds = card credits, never split          | Never loses a cent; matches the bank statement                                                                   |
| 2026-10-04 | Closing-day change: snapshots kept; new cycle starts at the last closing; a due month already taken rolls to the next cycle          | One invoice per card per due month, gap-free periods                                                             |
| 2026-10-04 | Card rows are edited only in text fields; value/date changes = delete + re-launch                                                    | Re-assigning invoices of a plan silently would surprise; explicit is safer                                       |
| 2026-10-04 | Recurring generation is lazy (on list), idempotent; account occurrences up to next month, card ones when due                         | No job scheduler to operate; forecast and bills always populated                                                 |
| 2026-10-04 | Grid hand-built instead of TanStack Table v9                                                                                         | Server-side filters, month-sized data; full control of keyboard editing                                          |
| 2026-10-04 | Ctrl/⌘+K = command palette (launch, jump, search); "+ Lançamento" and the FAB open quick add directly                                | One shortcut for everything, the fastest path stays one tap                                                      |
| 2026-10-04 | `DATABASE_POOL_SIZE` (default 10); tests on the in-memory DB use 1                                                                   | PGlite serves one connection reliably — fixed flaky "Connection terminated"                                      |
| 2026-10-05 | "Contas a pagar" window = everything unpaid up to the end of the month viewed, overdue from before always included                   | A late bill must never hide because you changed the month                                                        |
| 2026-10-05 | Paying a bill = confirming the row (undo → PENDING); paying an invoice = one TRANSFER row (undo → soft delete)                       | Both stay single rows, so balance, limit and status need no extra state                                          |
| 2026-10-05 | Partial invoice payments allowed, overpayment refused with the amount left                                                           | Matches how Brazilian cards work; keeps the invoice from going negative                                          |
| 2026-10-05 | "Receitas" reuses `/transactions?kind=income` instead of its own endpoint                                                            | Same rows, same filters — one list to keep correct                                                               |
| 2026-10-05 | The dashboard is **one** request (`GET /summary?month=`), aggregated in SQL                                                          | Three aggregates on the server beat a dozen round trips and keep the formulas in one place                       |
| 2026-10-05 | Dashboard charts hand-drawn (SVG donut, box bars) instead of Recharts                                                                | Recharts stays lazy behind `/design`; the shell bundle doesn't grow and the style matches the drawing exactly    |
| 2026-10-05 | Dashboard split into `panels/`, the page is assembly only                                                                            | Each panel fetches what it needs and can be reordered without touching the others                                |
| 2026-10-05 | Spending by category rolls children into the parent and shows at most 5 slices + "Outros"                                            | A ring stops being readable past five; the list below still carries every number                                 |
| 2026-10-05 | Imports are parsed **in the browser**; the API only ever sees JSON rows                                                              | No multipart uploads, no file on the server, and the Origin check and cookie keep working unchanged              |
| 2026-10-05 | Nothing is written until the person confirms the list (guesses and duplicates shown first)                                           | A statement is messy; a silent import is very hard to undo by hand                                               |
| 2026-10-05 | Duplicates = same day + same amount + same account/card, matched one existing row per line                                           | Catches a re-imported statement without collapsing two genuinely identical purchases                             |
| 2026-10-05 | Category guessed from the household's own history (60% word overlap), never from a built-in list                                     | Every couple names things their way; the app learns from what they already did                                   |
| 2026-10-05 | `read-excel-file` / `write-excel-file` instead of SheetJS, imported on demand                                                        | npm's `xlsx` is stuck on the vulnerable 0.18.5; these are maintained and stay out of the shell bundle            |
| 2026-10-05 | CSV is written with `;` and a BOM                                                                                                    | Excel pt-BR uses the comma as the decimal mark and needs the BOM to read UTF-8                                   |
| 2026-10-05 | Changing the password ends every **other** session, never this one                                                                   | Locking out a borrowed screen is the point; logging yourself out is not                                          |
| 2026-10-05 | Every screen is `lazy`; only the shell and the dashboard are in the first chunk                                                      | 262 → 181 KB gzip, and a phone pays for a screen when it opens it                                                |
| 2026-10-05 | `eslint-plugin-jsx-a11y` enforces the accessibility conventions, with exemptions written next to the code                            | A one-time audit rots; a rule does not — it already caught labels that named nothing                             |
| 2026-10-05 | Test files give the single in-memory connection back in `afterAll`                                                                   | PGlite serves one connection: a file that walks away holding it made the next one fail                           |

---

## Phase 0 — what was delivered

- **Monorepo & tooling:** pnpm workspaces, strict TS (`noUncheckedIndexedAccess`…), ESLint 10
  type-checked flat config (+ react-hooks, react-refresh), Prettier + Tailwind class sorting,
  Vitest. `pnpm check` is green.
- **Shared package:** money (format/parse/allocate), calendar dates (São Paulo), enums + pt-BR
  labels, Zod primitives, palette & icon keys, default category tree — 36 unit tests.
- **Database:** full Prisma schema (16 models), init migration (`20261003000000_init`) with
  CHECK constraints, enum parity check, idempotent seed (2 users, household, 20 categories +
  41 subcategories, 6 accounts, 3 cards, 7 recurring rules). Verified end-to-end against a
  throwaway Postgres: migrate deploy ✔, seed/re-seed/reset ✔, CHECKs reject bad rows ✔,
  no schema drift ✔.
- **API skeleton:** Express 5, env validation, pino logging (redacted cookies), helmet,
  request ids, pt-BR error handler, `/api/health` with DB probe, graceful shutdown, tsup build.
- **Design system:** two directions as tokens (light + dark each), validated categorical
  palette, core components, AppShell (desktop sidebar / tablet rail / mobile bottom nav + FAB),
  placeholder screens for every route, quick-add preview (Ctrl/⌘+K or FAB), and the static
  design showcase at `/design`. Checked visually in light, dark, Grafite and at 375px.

## Phase 1 — what was delivered

- **Auth:** register / login / logout / me / switch-household; server-side sessions (hashed
  token, httpOnly + SameSite=Lax cookie, `__Host-` in prod, 30-day sliding expiry), Argon2id,
  timing-safe login, Origin check on writes, rate limiting on credential endpoints.
- **Household & invites:** household + default categories on sign-up; owner invites by link
  (copy / WhatsApp / share sheet), single-use, expiring, revocable; the partner joins by
  registering or logging in with the invited e-mail; member roles; own name & colour.
- **Categories & budgets:** tree (one level), icon & colour pickers, monthly budget (expenses),
  archive with undo (cascades to children), restore, delete when unused, case-insensitive
  sibling uniqueness, tenant isolation.
- **Accounts:** CRUD with derived balances (initial balance + PAID movements since its date, one
  SQL aggregate), totals by holder (each member / joint), negative opening balances, archive
  with undo, delete only when unused.
- **Web:** auth screens (split layout), accept-invite page for every case (new person, existing
  account, logged in with the right/wrong account, used/expired/revoked links), route guards
  with `?next=`, real data in the shell (household chip, user menu, logout on mobile), dashboard
  with "Primeiros passos", Accounts, Categories & Orçamentos, Settings (household, people,
  invites, appearance, account), quick add on real data.
- **Tests:** 40 API integration tests (auth, CSRF/Origin, rate limit, sessions, invites,
  categories, accounts incl. balance derivation, household roles, tenant isolation) + 41 shared
  unit tests. `pnpm check` green. Verified in the browser end-to-end on desktop and 375px:
  login/redirects, account & category CRUD, archive + Desfazer, invite → partner sign-up →
  shared household, logout.

## Design & shared-money update — what was delivered (2026-10-04)

- **Money model — everything is shared:** removed `SplitMode`, `Household.defaultSplitMode`,
  `Transaction.splitMode`/`splits`, `RecurringRule.splitMode`/`splits`, `TransactionSplit`,
  `RecurringRuleSplit` and `Settlement` (migration `20261004120000_shared_household_money`, which
  also maps old palette data to tones and re-tones members by join order). `paidById` stays as
  "pago por" (information only); account/card holders stay. Shared enums/schemas/DTOs, API
  (`PATCH /household` = name only), `deleteHouseholdData`, seed and tests updated.
- **Palette → tones:** `PALETTE_KEYS = 700 · 300 · 900 · 500 · neutral` with pt-BR labels; default
  categories, members, accounts and cards use tones; a schema test rejects retired hue keys.
- **Design system "Casa" on Industry** (see [Design system](#design-system--casa-on-industry)):
  `planta.css` tokens (light + dark), Barlow / Barlow Condensed, `.blueprint` marks, `desk`
  900px breakpoint, motion tokens; every primitive re-skinned (square, hairline, steel focus);
  new `KpiGrid`/`KpiCell`, `Ruler`, `AppHeader`, `MoreSheet`, `HouseGlyph`, `MonthProvider`.
- **Flow from the prototype:** sidebar groups + balance footer; sticky header with title, shared
  month, "Lançar ou buscar · Ctrl K" and "+ Lançamento"; mobile bottom bar with square FAB;
  quick add as a blueprint dialog (bottom on phones) with "Pago por" and a live hint; login /
  sign-up with the deep steel panel and Entrar | Criar conta tabs; placeholders "Chega na Fase N".
- **Screens restyled:** dashboard (KPI strip with real balance, getting started, monthly budgets
  with rulers, accounts), accounts (KPI summary by holder, blueprint cards), categories, settings
  (no default split, no style switch; link to the design system), accept-invite, 404/error/boot.
- **Showcase `/design` rebuilt:** directions A/B side by side, ramps, roles, meaning-without-
  colour, tones, type scale, shape & motion, money, components, patterns (KPIs, próximas contas,
  cartões, lançamentos table) and charts (hand-drawn donut + Recharts bars) in the new style.
- **Checks:** `pnpm check` green (41 shared + 40 API tests). Verified in headless Chrome at
  1440px and 375px, light and dark: login/register, dashboard, accounts (+ sheet), categories,
  settings, placeholder, month popover, quick add (desktop + phone), "Mais" sheet, showcase —
  no horizontal overflow at 375px.

## Phase 2 — what was delivered (2026-10-04)

- **Invoice engine** (`packages/shared/src/invoices.ts`): pure `resolveInvoiceCycle`,
  `resolveInstallmentCycle`, `installmentDate`, `invoiceStatus` + `INVOICE_STATUS_LABELS`; every
  row of the edge-case table, snapshots after a closing-day change, gap-free and non-overlapping
  periods, one invoice per due month, installments shifting the cycle — 24 unit tests. Shared by
  the API (assignment) and the web (previews).
- **API:** cards CRUD/archive with derived limit (one SQL aggregate) and current invoice;
  invoices with derived totals/status (one SQL aggregate, `loadInvoices`); card purchases with
  installment plans (`allocateCents`), refunds, scoped edit/delete ("só esta / esta e as
  próximas / todas"), restore for "Desfazer", warning when landing on a paid invoice;
  tenant isolation. 13 integration tests.
- **Web:** "Cartões & Faturas" (`/cartoes`, `/cartoes/:cardId`): card list (status, current
  invoice, limit ruler), card detail (KPIs, invoice strip driven by the header month, invoice
  table with installments "2/10", refunds, per-scope delete + Desfazer), archived cards; card
  form with a live "melhor dia de compra" preview; "Nova compra" sheet (installments with
  per-installment value, refund, invoice preview); quick add saves **card** purchases for real
  (with installments, invoice hint, Desfazer) — account entries stay a preview until Phase 3;
  dashboard "Cartões" panel.
- **Seed:** card purchases relative to today, incl. installment plans.
- **Checks:** `pnpm check` green (65 shared + 53 API tests). Verified in headless Chrome at 1440px
  and 375px (no overflow): cards page, invoice switching, purchase sheet preview, quick add saving
  a 3x purchase into the right invoice, dashboard panel.

## Phase 3 — what was delivered (2026-10-04)

- **Shared:** transaction & recurring-rule schemas (shapes mirror the DB CHECKs), `TransactionDto`,
  totals and `RecurringRuleDto`; recurrence engine (monthly on the 31st without drift, weekly,
  yearly Feb 29, intervals, end dates) — 4 more unit tests.
- **API:** `/transactions` (month list with filters and totals — card credits lower spending,
  transfers are neither income nor expense; create/edit/soft-delete/restore; pending ↔ paid with
  `paidDate`; card rows locked to text fields) and `/recurring-rules` (CRUD, pause/resume,
  edits applied to pending occurrences from today, delete keeps history) with lazy idempotent
  generation (`ensureOccurrences`). 12 integration tests. `DATABASE_POOL_SIZE` env (tests use 1).
- **Web — "Lançamentos"** (`/lancamentos`): desktop spreadsheet grid (hand-built, `role="grid"`):
  arrow keys move between cells, Enter/F2/double click edits in place (description, value, date,
  category, account, paid-by), status toggles pending ↔ paid, card rows locked with a hint, row
  menu with scoped delete + Desfazer, sticky totals; the design's inline "next row" bar (Enter
  adds, accounts or cards, category decides expense/income); kind filters, drill-down chips from
  the URL (`?categoryId=`, `?accountId=`, `?creditCardId=`, `?kind=`), search; phones get a list
  grouped by day. Full form sheet for transfers, pending bills (due date) and notes.
  **Recorrências** view: list with frequency text, next date, pause/resume, delete (confirm), sheet.
- **Quick add** saves everything for real (account entries and card purchases) with Desfazer.
- **Command palette** (Ctrl/⌘+K, header "Lançar ou buscar", search icon on phones): launch quick
  add / detailed form / card purchase, jump to any screen, search the month's transactions.
- **Dashboard:** real Receitas/Despesas (clickable → filtered grid), forecast = balance + to
  receive − to pay this month (invoices join in Phase 4), budgets with real spending per category
  (children roll up; card credits subtract) and 80%/100% tags, rows link to the filtered grid.
- **Seed:** account movements this month + transfer; recurring rules now materialize.
- **Checks:** `pnpm check` green (69 shared + 65 API tests). Verified in headless Chrome: grid,
  inline add, in-place edit, recurring view, palette search, dashboard numbers, 375px list (no
  overflow).

## Phase 4 — what was delivered (2026-10-05)

- **Shared:** bill schemas (`payInvoiceSchema`, `payBillSchema`, `listBillsQuerySchema`), `BillDto`
  with buckets + `BILL_BUCKET_LABELS`, `BillTotalsDto`.
- **API — bills projection** (`/bills`): pending expense rows with a due date **plus** invoices
  with a balance, up to the end of the month on screen; overdue from earlier months always comes
  along, so changing the month never hides a late bill. Each line carries its bucket, days until
  due, the account to pay from (the row's, or the card's payment account) and, for invoices,
  total/paid. Recurring occurrences are materialized first, so next month's bills are there.
- **API — payments:** `POST /bills/:id/pay` (confirms a pending row) and
  `POST /invoices/:id/payments` (TRANSFER account → invoice, partial allowed, overpayment
  refused). Balance, card limit and invoice status all follow from that one row.
  8 integration tests (buckets, ordering, overdue across months, partial payment, overpayment,
  undo, isolation).
- **Web — "Contas a pagar"** (`/contas-a-pagar`): list grouped by urgency with the design's date
  boxes, overdue in an ink frame + the word "Atrasada", KPIs (atrasadas / ainda a pagar / já
  pagas), a "Pagas no mês" section, and a **month calendar** view (`?view=calendario`) with a
  banner for overdue bills from earlier months. One dialog pays either kind: account, date, and
  for invoices how much (partial), always with "Desfazer".
- **Web — "Receitas"** (`/receitas`): month incomes with received / to receive / total, "Recebi"
  in one tap (asks for the account when the row has none), per-person breakdown with rulers, and
  the full sheet for editing.
- **Dashboard:** "Próximas contas" panel (date boxes, "Vence hoje" / "em N dias" / "Venceu há N
  dias"), and the forecast now subtracts **bills and invoices** due, not just pending rows.
- **Checks:** `pnpm check` green (69 shared + 73 API tests). Verified in headless Chrome at 1440px
  and 375px: bills list and calendar, paying a bill (balance and totals follow, Desfazer offered),
  paying part of an invoice (remaining shown, card limit freed), incomes, dashboard.

## Phase 5 — what was delivered (2026-10-05)

- **Shared:** `CategorySpendDto` (spent, share in bps, budget and usage), `MonthPointDto`,
  `BudgetAlertDto`, `DashboardSummaryDto`.
- **API — `GET /summary?month=`** (`domain/summary/summary.service.ts`): three SQL aggregates —
  spending by category with subcategories rolled into their parent (card credits subtract,
  transfers and card-payment rows never count), income × expense for the last 6 months
  (`to_char(date,'YYYY-MM')`, months without data filled in), and the month's totals. Budget
  alerts come from `BUDGET_ALERT_THRESHOLDS_BPS` (80% / 100%), worst first. The whole dashboard
  is one request. 5 integration tests (rollup & share, pending + card credits + transfers,
  alert thresholds and ordering, the 6-month window with empty months, validation + isolation).
- **Charts without a chart library:** `Donut` (168px, r 62, 16px ring, 2px gaps — slices are
  dashes of one circle, hover dims the rest and the middle shows that slice) and `TrendBars`
  (income outlined, expense filled, the month on screen in steel-900, bars `aria-hidden` with a
  "Ver como tabela" table). Recharts stays out of the shell bundle, only `/design` loads it.
- **Dashboard rebuilt as panels** (`features/dashboard/panels/`), the page itself is assembly:
  alert strip → KPIs → "Gastos por categoria" (donut + ranked list with each budget's ruler,
  top 5 + "Outros") → "Últimos 6 meses" → próximas contas + cartões → primeiros passos → contas.
- **Everything is a door:** a slice or a list row, a budget tag, a card, an account and a month
  label all open the pre-filtered grid (`/lancamentos?categoryId=…`), the month ones switching
  the shared month first.
- **Checks:** `pnpm check` green (69 shared + 78 API tests). Verified in headless Chrome at 1440px
  and 375px, light and dark: donut and hover, trend bars + table view, alert tags, drill-down
  landing on `?categoryId=` with the category chip, no horizontal overflow on the phone layout.

## Phase 6 — what was delivered (2026-10-05)

- **Shared:** `import-export.ts` schemas (`importRowSchema`, preview/commit with exactly one
  target, `exportQuerySchema`, `MAX_IMPORT_ROWS` 2000), `changePasswordSchema`, and the
  `ImportPreviewDto` / `ExportDto` shapes.
- **Import — the file never leaves the device.** The browser reads the CSV/XLSX, maps its
  columns and sends plain JSON rows, so the API stays JSON-only (the Origin check and the
  cookie keep working) and nothing is written before the person sees it. `POST /import/preview`
  guesses each category from how the household filed that shop before (`domain/import/match.ts`:
  accents and punctuation stripped, noise words like "pix"/"ltda" dropped, 60% of the smaller
  description's words must match) and flags lines whose day + amount are already in the ledger —
  one existing row per line, so two identical lines don't both count as duplicates.
  `POST /import/commit` writes everything in one database transaction; card lines land on the
  invoice of their date exactly like a typed purchase. `POST /import/undo` takes it all back.
- **Web — "Importar extrato"** (`/importar`), three steps that never surprise: _de onde vem_
  (conta or cartão + the file, dropped or chosen), _quais colunas_ (guessed from the header, or
  from the shape of the first line; header and "valores positivos são despesas" toggles; a live
  sample showing which lines will be ignored and why), _confira e importe_ (every line with its
  guessed category, the ones already in the ledger unticked, then one button). Finishes on the
  grid with "Desfazer".
- **Parsing, tested** (`features/import/parse.ts`, 12 web unit tests — the first in `apps/web`):
  dates `31/12/2026`, `01-02-26`, `2026-12-31`; money `R$ 1.234,56`, `1,234.56`, `-45,90`,
  `45,90-`, `(45,90)`; CSV with `;` or `,`, quoted fields and doubled quotes; a separate
  "crédito" column; a date column never mistaken for the amount.
- **Export:** "Exportar" on Lançamentos — the month or the whole year, CSV (BOM + `;`, opens in
  Excel pt-BR) or XLSX (money stays a number). `GET /export` returns names instead of ids
  (`Mercado › Feira & hortifrúti`, `Conta → Cartão`) and signs the amounts so any column total
  means something.
- **Account care:** password change in Configurações — asks for the current one, keeps this
  session and drops every other one.
- **Performance:** every screen is now `lazy`; the main chunk went from ~262 KB to **181 KB
  gzip**, and the spreadsheet readers load only when a file is chosen.
- **Accessibility:** `eslint-plugin-jsx-a11y` is on, so the rules in these conventions are
  enforced instead of remembered. It found a real bug: a `<label>` cannot name a Radix switch
  (it renders a `<button role="switch">`), so five switches had no accessible name — fixed once
  in a new `SwitchField`. The remaining exemptions are written down where they are (autofocus
  inside something the person just opened; key handlers delegated from a grid's focusable cells).
- **Checks:** `pnpm check` green — 69 shared + 12 web + 89 API tests. Verified in headless
  Chrome at 1440px and 375px: a five-line statement read, the bad line skipped, "Padaria"
  guessed from history, 4 rows written and visible in the grid with "Desfazer", the export menu
  and payload, the password fields, no horizontal overflow on the phone layout.

## Next step — after Phase 6

The roadmap is finished. What is worth doing next, roughly in order:

1. **Password reset and change of e-mail**, once there is e-mail infrastructure (the only part
   of "account care" still missing).
2. **Reports:** a year view (month by month, category by category) and comparisons between
   months, reusing the summary aggregates.
3. **Import from the cards' own invoices** (PDF/OFX), and remembering a bank's column mapping so
   the second import is one click.
4. **Operations:** backup/restore of a household, and a look at the VPS/Caddy setup together.

Git: `origin` = github.com/derekzinnn/Spendt (commit after each phase).
