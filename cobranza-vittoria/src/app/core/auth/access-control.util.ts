import { AccessRule, Session } from './session.models';

export const ACCESS_RULES = {
  // El contrato solo garantiza autorización fina en Requerimientos en esta iteración.
  requerimientos: { anyPermission: ['requerimientos.ver'] },
  // Control de Acceso usa el rol Administrador como fachada temporal, no como garantía del backend.
  controlAccesos: { anyRole: ['Administrador'] },
  // Control Presupuestario: el backend valida cada permiso por capacidad; esto solo oculta el menú.
  controlPresupuestario: {
    anyPermission: [
      'control_presupuestario.presupuesto.ver',
      'control_presupuestario.reporte.ver',
      'control_presupuestario.centro_costo.ver',
      'control_presupuestario.partida.ver'
    ]
  },
  controlPresupuestarioCentrosCosto: {
    anyPermission: ['control_presupuestario.centro_costo.crear', 'control_presupuestario.centro_costo.actualizar']
  },
  controlPresupuestarioPartidas: {
    anyPermission: ['control_presupuestario.partida.crear', 'control_presupuestario.partida.actualizar']
  },
  controlPresupuestarioPresupuestos: { anyPermission: ['control_presupuestario.presupuesto.ver'] },
  controlPresupuestarioReportes: { anyPermission: ['control_presupuestario.reporte.ver'] }
} satisfies Record<string, AccessRule>;

export function canAccess(session: Session | null, rule?: AccessRule): boolean {
  if (!session) return false;
  if (!rule) return true;

  // Si una regla declara roles y permisos, basta cumplir cualquiera de los dos grupos.
  const roleMatch = rule.anyRole?.some(role => session.roles.includes(role)) ?? false;
  const permissionMatch = rule.anyPermission?.some(permission => session.permisos.includes(permission)) ?? false;
  return roleMatch || permissionMatch;
}
