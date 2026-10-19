import { AccessRule, Session } from './contratos-sesion';

export function canAccess(session: Session | null, rule?: AccessRule): boolean {
  if (!session) return false;
  if (!rule) return true;

  // Si una regla declara roles y permisos, basta cumplir cualquiera de los dos grupos.
  const roleMatch = rule.anyRole?.some((role) => session.roles.includes(role)) ?? false;
  const permissionMatch =
    rule.anyPermission?.some((permission) => session.permisos.includes(permission)) ?? false;
  return roleMatch || permissionMatch;
}

// Los datos del router son un límite sin tipado de dominio; validar antes de usarlos.
export function esReglaAcceso(value: unknown): value is AccessRule {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([clave, contenido]: [string, unknown]) =>
      (clave === 'anyRole' || clave === 'anyPermission') &&
      (contenido === undefined ||
        (Array.isArray(contenido) && contenido.every((item: unknown) => typeof item === 'string'))),
  );
}
