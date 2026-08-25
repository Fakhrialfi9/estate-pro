# Authentication, Session, 2FA, and Authorization Workflows

## Login

Client → `POST /auth/login` → `LoginService` → user/credential/security repositories → Argon2 verification → optional 2FA challenge → `SessionService.create` → JWT issue → audit → response.

## Password change

Client → `POST /users/me/password` → authentication guard → `CredentialService.changePassword` → current-password verification → password policy → credential repository update → revoke all sessions for `PASSWORD_CHANGE` → response.

## Session

Bearer token → JWT verification → session activity check → protected controller. Logout or session revocation persists the revoked state, so subsequent protected requests fail. Session listing exposes only safe metadata.

## 2FA

Authenticated enrollment → TOTP secret generation/encrypted persistence → provisioning URI → TOTP verification → enable 2FA + recovery-code hashes → next login creates MFA challenge → TOTP/recovery verification → challenge consumption → session issuance.

## Authorization

Bearer token → JWT guard → `AuthorizationGuard` → permission/role metadata → `AuthorizationService.resolve` → effective policy assertion → controller/use case → repository/database → response. Role or role-permission changes are resolved from persistent state on the next request.
