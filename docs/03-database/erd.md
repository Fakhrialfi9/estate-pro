# Entity Relationship Diagram

The following Mermaid ERD records the security-critical relationships confirmed by the current Prisma schema. It intentionally does not invent relationships for scaffolded or unreviewed tables.

```mermaid
erDiagram
  AUTHENTICATION_USER ||--o{ AUTHENTICATION_USER_SESSION : owns
  AUTHENTICATION_USER ||--o{ AUTHENTICATION_REFRESH_TOKEN_FAMILY : owns
  AUTHENTICATION_USER_SESSION ||--o{ AUTHENTICATION_REFRESH_TOKEN_FAMILY : binds
  AUTHENTICATION_REFRESH_TOKEN_FAMILY ||--o{ AUTHENTICATION_REFRESH_TOKEN : contains
  AUTHENTICATION_USER ||--o| AUTHENTICATION_USER_CREDENTIAL : has
  AUTHENTICATION_USER ||--o| AUTHENTICATION_USER_SECURITY : has
  AUTHENTICATION_USER ||--o| AUTHENTICATION_USER_TWO_FACTOR : has
  AUTHENTICATION_USER ||--o{ AUTHENTICATION_USER_TWO_FACTOR_CHALLENGE : receives
  AUTHENTICATION_USER ||--o{ AUTHENTICATION_USER_TWO_FACTOR_RECOVERY_CODE : owns
  AUTHENTICATION_USER ||--o{ AUDIT_LOG : produces

  AUTHENTICATION_USER {
    BIGINT id PK
    CHAR uuid UK
    VARCHAR email
    VARCHAR username
    VARCHAR status
    BOOLEAN is_active
  }
  AUTHENTICATION_USER_SESSION {
    BIGINT id PK
    BIGINT user_id FK
    VARCHAR session_id UK
    DATETIME expires_at
    DATETIME revoked_at
  }
  AUTHENTICATION_REFRESH_TOKEN_FAMILY {
    CHAR id PK
    BIGINT user_id FK
    BIGINT session_id FK
    DATETIME revoked_at
  }
  AUTHENTICATION_REFRESH_TOKEN {
    BIGINT id PK
    CHAR family_id FK
    CHAR token_hash UK
    DATETIME expires_at
    DATETIME consumed_at
    DATETIME revoked_at
  }
```

`AuthenticationRefreshToken.token_hash` is the persisted representation of the opaque credential; the plaintext token is not an entity field.
