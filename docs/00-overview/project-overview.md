# Project Overview

## Purpose
Estate Pro is a NestJS/TypeScript HTTP API for a property-agent/sales management platform. The current implementation concentrates on authentication, authorization, user security, sessions, two-factor authentication, audit logging, observability, and the property domain.

## Users
The application supports authenticated users and administrative users with role/permission-based authorization. Property access is additionally enforced at the resource boundary, including ownership and active agent assignments.

## Scope represented by this repository
The API is versioned under `/api/v1`. The current implemented system includes HTTP authentication, server-side sessions, opaque refresh tokens, MFA/2FA, RBAC, property APIs, security auditing, health endpoints, validation, throttling, Helmet, CORS, and Prisma/MariaDB persistence.

## System overview
`Client -> NestJS HTTP API -> module/application services -> domain policies/ports -> Prisma repositories -> MariaDB`.

Authentication uses short-lived JWT access tokens plus server-side sessions and rotated opaque refresh tokens. The refresh token is returned only at the protocol boundary; only its SHA-256 digest is persisted. Protected requests require both a valid JWT and an active server-side session.

Business-domain modules for CRM, content, services, sales, and system exist as architectural module boundaries; where a module remains scaffolded, this document treats it as a boundary rather than claiming completed business behavior.
