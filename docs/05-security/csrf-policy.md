# CSRF policy

Estate Pro is currently a stateless HTTP API foundation. Authentication is not implemented yet, and the planned API boundary uses bearer credentials rather than an authentication cookie.

Therefore CSRF protection is **not enabled** at this stage. CSRF primarily protects browser-automatically-attached credentials such as cookies; adding a CSRF middleware to a stateless bearer-token API without that threat model would add complexity without addressing the relevant attack.

## Revisit condition

If authentication later stores credentials in cookies, or the API introduces state-changing browser flows that rely on ambient credentials, this policy must be revisited before those endpoints are released.

The decision must consider:

- credential transport (Authorization header vs cookie)
- same-origin and cross-origin behavior
- CORS configuration
- SameSite and Secure cookie policy
- state-changing HTTP methods
- whether a CSRF token is required by the chosen browser authentication model

This is an architectural decision, not a checklist item.
