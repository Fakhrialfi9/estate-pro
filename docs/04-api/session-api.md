# Session API

Base path `/api/v1/auth`.

- `GET /auth/sessions` lists the authenticated user's safe session metadata.
- `POST /auth/sessions/logout-all` revokes all own sessions.
- `DELETE /auth/sessions/:id` revokes an owned session by numeric public id.
- `POST /admin/session-management/users/:userUuid/sessions/:id/revoke` performs privileged session administration under `SessionAdminGuard`.

Session ids exposed to clients are public numeric database ids. Session secrets/digests are never returned. Session revocation and logout write audit events and invalidate future protected requests using the revoked session.
