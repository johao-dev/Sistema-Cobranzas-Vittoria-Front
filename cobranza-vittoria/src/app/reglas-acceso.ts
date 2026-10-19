import { AccessRule } from '../core/sesion/contratos-sesion';

export const ACCESS_RULES = {
  // Reglas de visibilidad conservadas durante la migración; la API autoriza cada operación.
  requerimientos: { anyPermission: ['requerimientos.ver'] },
  // Control de Acceso usa el rol Administrador como fachada temporal, no como garantía del backend.
  controlAccesos: { anyRole: ['Administrador'] },
  // Control Presupuestario: el backend valida cada permiso por capacidad; esto solo oculta el menú.
  controlPresupuestario: {
    anyPermission: [
      'control_presupuestario.presupuesto.ver',
      'control_presupuestario.reporte.ver',
      'control_presupuestario.centro_costo.ver',
      'control_presupuestario.partida.ver',
    ],
  },
  controlPresupuestarioCentrosCosto: {
    anyPermission: [
      'control_presupuestario.centro_costo.crear',
      'control_presupuestario.centro_costo.actualizar',
    ],
  },
  controlPresupuestarioPartidas: {
    anyPermission: [
      'control_presupuestario.partida.crear',
      'control_presupuestario.partida.actualizar',
    ],
  },
  controlPresupuestarioPresupuestos: { anyPermission: ['control_presupuestario.presupuesto.ver'] },
  controlPresupuestarioReportes: { anyPermission: ['control_presupuestario.reporte.ver'] },
} satisfies Record<string, AccessRule>;
