# CRM audit policy

CRM mutations are audited at the application boundary through the existing `SECURITY_AUDIT_REPOSITORY` port. Controllers do not write audit records directly.

| Operation | Audit event | Required actor |
|---|---|---|
| Contact create/update/archive | `CRM_CONTACT_*` | Authenticated |
| Contact consent/relationship mutation | `CRM_CONTACT_CONSENT_RECORDED`, `CRM_CONTACT_RELATIONSHIP_*` | Authenticated |
| Lead create/update/archive | `CRM_LEAD_*` | Authenticated |
| Lead assignment/status change | `CRM_LEAD_ASSIGNED`, `CRM_LEAD_UNASSIGNED`, `CRM_LEAD_STATUS_CHANGED` | Authenticated |
| Lead score recalculation | `CRM_LEAD_SCORE_RECALCULATED` | Authenticated |
| Duplicate review/merge | `CRM_DUPLICATE_REVIEWED`, `CRM_LEAD_MERGED` | Authenticated + permission |
| CRM configuration mutation | `CRM_*_CREATED`, `CRM_*_UPDATED`, `CRM_*_ARCHIVED` | Authenticated + management permission |
| Inquiry authenticated mutation/conversion | `CRM_INQUIRY_*` | Authenticated |
| Activity mutation/lifecycle transition | `CRM_ACTIVITY_*` | Authenticated |
| Communication mutation/lifecycle | `CRM_COMMUNICATION_*` | Authenticated |
| Template mutation | `CRM_TEMPLATE_*` | Authenticated + management permission |

Secrets, passwords, access tokens, refresh tokens, provider credentials, and raw database credentials must never be included in audit payloads. Client-supplied derived score values and provider secrets are rejected rather than recorded.

Historical consent and lead history are treated as audit-relevant data. They are appended or transitioned through explicit domain operations rather than overwritten as a current-state shortcut.
