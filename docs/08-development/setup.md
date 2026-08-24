# Setup

## Prerequisites

- Node.js 22.x (the repository declares `engines.node = 22.x`).
- npm 11.18.0 (the repository declares `packageManager = npm@11.18.0`).
- A reachable MariaDB/MySQL-compatible database for runtime/database tests.
- Git.

## 1. Clone

```bash
git clone https://github.com/Fakhrialfi9/estate-pro.git
cd estate-pro
git checkout main
```

This repository follows a main-only workflow: do not create another branch.

## 2. Install

For a normal installation:

```bash
npm ci
```

For a clean developer bootstrap:

```bash
npm run fresh
```

`fresh-install.sh` removes generated development artifacts and `node_modules`, installs exactly from `package-lock.json`, generates Prisma, and creates `.env` from `.env.example` only when `.env` does not already exist.

## 3. Configure environment

```bash
cp .env.example .env
```

Replace database placeholders and provide a local `JWT_SECRET` of at least 32 characters. Provide `TWO_FACTOR_ENCRYPTION_KEY` when 2FA is enabled. Never commit `.env` or real credentials.

## 4. Database and Prisma

Validate/generate Prisma client:

```bash
npm run prisma:generate
```

For local development migrations:

```bash
npm run prisma:migrate
```

For a deployment database with committed migrations:

```bash
npm run prisma:deploy
```

Check migration state:

```bash
npm run prisma:status
```

Open Prisma Studio when needed:

```bash
npm run prisma:studio
```

Do not invent a seed command: the current `package.json` does not expose one.

## 5. Development

```bash
npm run start:dev
```

Production-like execution after a successful build:

```bash
npm run build
npm run start:prod
```

## 6. Quality and architecture checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm run check:architecture
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:security
npm run test:coverage
npm run build
```

`check:architecture` validates the TypeScript source dependency graph, including circular dependency detection and cross-module internal import rules, in addition to the repository's explicit boundary checks.

The database-dependent checks require a valid database configuration where the tested code path needs it.

## 7. Clean development state

Soft cleanup keeps installed dependencies:

```bash
npm run clean:soft
```

Hard cleanup removes generated development artifacts and `node_modules`, but deliberately preserves `package-lock.json` and source/configuration files:

```bash
npm run clean:hard
```

## Reproducibility rule

A fresh environment must be able to use the committed lockfile. Do not replace `npm ci` with `npm install` for reproducible installation. If dependencies change, update `package.json` and `package-lock.json` together.
