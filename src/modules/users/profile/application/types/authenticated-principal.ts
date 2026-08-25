export interface AuthenticatedPrincipal {
  sub: string;
  permissions?: readonly string[];
}
