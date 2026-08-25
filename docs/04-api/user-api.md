# User API

All routes are served under `/api/v1` and use the controller contracts in `UsersController`, `UserProfileController`, and `CredentialsController`.

## User management

`POST /users` creates an identity record. `GET /users` lists/searches users. `GET /users/:uuid` reads a user. `GET /users/email/:email` and `GET /users/username/:username` provide privileged identity lookups. `PATCH /users/:uuid` updates allowlisted identity/account fields. `DELETE /users/:uuid` performs a soft delete/deactivation and session invalidation.

User CRUD does not accept credential material. Credential operations are isolated to the credentials boundary.

## Profile

`POST /users/:uuid/profile`, `GET /users/:uuid/profile`, and `PATCH /users/:uuid/profile` are protected by `ProfileAuthenticationGuard` and the application service enforces owner access.

## Credential

`POST /users/me/password` verifies the current password, validates the replacement password and confirmation, persists the new Argon2 hash, and invalidates existing sessions.
