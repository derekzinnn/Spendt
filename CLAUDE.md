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

> **Infra is owned by the user** (Docker, Caddy, DNS, deploy). Never create Dockerfiles,
> docker-compose, CI files or deploy scripts. Only application code + `.env.example`.

> **Teaching rule:** whenever a new technical concept is introduced, first explain it in
> "banana-simple" language with an everyday analogy, then technically. See [Glossary](#glossary-banana-simple).

---

## Status

| Phase | Scope                                                                                 | Status                   |
| ----- | ------------------------------------------------------------------------------------- | ------------------------ |
| **0** | Monorepo, tooling, full Prisma schema, seed, design system, AppShell, design showcase | ✅ **Done** (2026-10-03) |
| **1** | Auth, household, invite flow, categories, accounts                                    | ✅ **Done** (2026-10-03) |
| 2     | Credit cards, invoice engine (closing/due logic), installments                        | ⏭️ **Next**              |
| 3     | Transactions grid ("Excel"), quick add, command palette, recurring rules              | ⏳                       |
| 4     | Bills to pay (list + calendar), invoice payment, incomes                              | ⏳                       |
| 5     | Dashboard, budgets and alerts, clickable drill-downs                                  | ⏳                       |
| 6     | Import/export CSV/XLSX, polish, accessibility and performance pass                    | ⏳                       |

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

| Layer    | Choice (version)                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo | pnpm 11 workspaces (`apps/*`, `packages/*`)                                                                                                                                                                         |
| Web      | React 19, Vite 8, TypeScript 6.0, Tailwind CSS 4 (CSS-first config), shadcn/ui patterns on Radix (`radix-ui`), React Router 8, TanStack Query 5, React Hook Form 7 + Zod 4, Recharts 3, lucide-react, sonner        |
| API      | Node 24, Express 5, Prisma 7.10 (`prisma-client` generator + `@prisma/adapter-pg`), Zod 4, pino, helmet, cookie-parser, express-rate-limit, Argon2id (`@node-rs/argon2`); tests: Vitest + supertest + `@prisma/dev` |
| Shared   | `packages/shared` — TypeScript source consumed directly (money, dates, enums, Zod primitives, defaults)                                                                                                             |
| Tooling  | ESLint 10 flat config + typescript-eslint (type-checked), Prettier 3 + Tailwind plugin, Vitest 5, tsup, tsx                                                                                                         |

Planned but not yet installed (install when the phase needs them): TanStack Table (Phase 3),
date-fns + `@date-fns/tz` (Phase 3 grid/date pickers). SheetJS or similar (Phase 6).

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
│   ├── dates.ts                  ← calendar-date & month helpers in America/Sao_Paulo (+ tests)
│   ├── enums.ts                  ← domain enums + pt-BR labels (mirror of Prisma enums)
│   ├── palette.ts                ← tone keys (700 · 300 · 900 · 500 · neutral) + pt-BR labels
│   ├── category-icons.ts         ← icon keys allowed for categories
│   ├── schemas/                  ← Zod: primitives, auth, household, category, account (+ tests)
│   ├── dto.ts                    ← response shapes (MeDto, CategoryDto, AccountDto, InviteDto…)
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
│       ├── routes/               ← auth, invites, household, categories, accounts, health
│       ├── middleware/           ← auth (loadSession/require*/scopeOf), origin-check, rate-limit, error-handler
│       ├── domain/               ← services: auth (session, register/login), households, invites, categories, accounts
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
        ├── components/data/      ← KpiGrid/KpiCell, Ruler
        ├── components/month-picker/ · empty-state/ · member/ · layout/ (AppShell, AppHeader, Sidebar,
        │                           BottomNav + MoreSheet, BrandMark, PageHeader, nav-link-class)
        ├── features/             ← auth/, dashboard/, accounts/, categories/, settings/, household/ (api hooks),
        │                           quick-add/, placeholder/, design-showcase/ (+ its static demo-data)
        └── lib/                  ← api fetch, query client + keys, session-cache, form-errors, undo-toast, theme,
                                    privacy, month (MonthProvider), brand (APP_NAME), storage, media queries,
                                    css colors
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
reports and `invoiceId` of cycle _k_. Remainder cents go to the **first** installment
(Phase 2 to confirm with `allocateCents`).

---

## Integration rules (what makes the app useful)

1. A credit-card purchase is automatically assigned to the right invoice (purchase date vs closing day — rule above).
2. Each invoice shows up automatically in "Contas a pagar" on its due date.
3. Paying an invoice creates a TRANSFER from the linked account → updates the account balance and frees the card limit.
4. Recurring rules feed both the monthly forecast and "Contas a pagar" (PENDING occurrences, idempotent per `occurrenceDate`).
5. Category budgets compare against real spending in real time and raise dashboard alerts at **80%** and **100%** (`BUDGET_ALERT_THRESHOLDS_BPS`).
6. The dashboard is fully clickable: category slice, card, member or month → transactions grid pre-filtered.
7. "Pago por": every expense/income records who paid or received it — information for the couple, never a debt (everything is shared).
8. Create anything inline: typing a category/card that doesn't exist offers **Criar "X"** in place — never leave the flow (pattern already in `QuickAddForm`).

---

## API (Phase 1)

All JSON under `/api`. Writes require our Origin (or no browser Origin at all). 🔒 = session,
🏠 = active household, 👑 = household owner, ⏱ = rate-limited.

| Method & path                                                            | Auth               | Purpose                                                                                      |
| ------------------------------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------- |
| `GET /health`                                                            | —                  | Liveness + DB probe                                                                          |
| `POST /auth/register`                                                    | ⏱                  | Create user + household (default categories), or join one with `inviteToken`; starts session |
| `POST /auth/login` · `POST /auth/logout`                                 | ⏱ · —              | Session start (fresh token) / end (server-side)                                              |
| `GET /auth/me`                                                           | 🔒                 | `MeDto`: user, active household, members, memberships                                        |
| `POST /auth/switch-household`                                            | 🔒                 | Change the session's active household                                                        |
| `GET /invites/:token` · `POST /invites/:token/accept`                    | ⏱ · 🔒⏱            | Public invite preview · accept (e-mail must match)                                           |
| `PATCH /household`                                                       | 🏠👑               | Household name                                                                               |
| `PATCH /household/members/me`                                            | 🏠                 | Own display name & colour (distinct per household)                                           |
| `GET/POST /household/invites` · `DELETE /household/invites/:id`          | 🏠 (👑 for writes) | Pending invites; create (link shown once, 7 days); revoke                                    |
| `GET/POST /categories` · `PATCH /categories/:id`                         | 🏠                 | List (`?includeArchived=true`), create, edit                                                 |
| `POST /categories/:id/archive` · `/unarchive` · `DELETE /categories/:id` | 🏠                 | Archive cascades to children; delete only if unused                                          |
| `GET/POST /accounts` · `PATCH /accounts/:id`                             | 🏠                 | List with derived `balanceCents`, create, edit                                               |
| `POST /accounts/:id/archive` · `/unarchive` · `DELETE /accounts/:id`     | 🏠                 | Delete only if no movements/rules                                                            |

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
  Ctrl K" and the primary "+ Lançamento" · content max 1400px, 28px rhythm.
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

## Next step — Phase 2 (credit cards, invoice engine, installments)

1. **Shared:** `resolveInvoiceCycle(card, purchaseDate)` + `installmentCycle(…, k)` as pure
   functions in `@spendly/shared`, unit-tested for **every** row of the edge-case table above
   (31st/February, exactly-on-closing, leap year, due-before-closing, snapshot override); pure
   invoice status/total helpers.
2. **API — cards:** CRUD with archive (`/api/cards`), validation (days 1–31, payment account in
   the household, holder member or shared), available-limit query (formula above).
3. **API — invoices:** `findOrCreateInvoice` (upsert on `[creditCardId, referenceMonth]`, period
   snapshot, gap-free `periodStart`), `GET /api/cards/:id/invoices` timeline with derived totals
   and status, invoice detail with its transactions.
4. **API — card purchases & installments:** minimal create endpoint for card purchases (the full
   grid is Phase 3) that assigns the invoice; `InstallmentPlan` + n transactions (remainder cents
   in the first installment via `allocateCents`); edit/delete scopes "só esta / esta e as
   próximas / todas"; decide refunds (estornos).
5. **Web:** "Cartões & Faturas" — card list (showcase pattern: status tag, invoice, dates, limit `Ruler`), current invoice +
   available limit, invoice timeline per card, invoice detail; card form sheet; cards as payment
   options in quick add.
6. Tests: invoice-engine unit tests + API integration tests for assignment, installments and
   limit; keep `pnpm check` green.

Known follow-ups: main JS chunk is ~242 KB gzip — split routes (`lazy`) and the quick-add form
in the Phase 6 performance pass. Password reset / change e-mail not built yet (no e-mail
infrastructure) — consider for Phase 6. No git repository yet (`git init` when ready).
