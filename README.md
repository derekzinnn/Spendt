# Spendly

Planejador financeiro do casal — the shared household finance app for two.

Everything about the project (stack, conventions, domain rules, design system, roadmap and
decisions) lives in **[CLAUDE.md](./CLAUDE.md)**.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL and SEED_PASSWORD
pnpm db:deploy && pnpm db:seed
pnpm dev                                 # http://localhost:5173 (design system at /design)
```
