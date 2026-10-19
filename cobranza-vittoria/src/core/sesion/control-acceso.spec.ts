import { describe, expect, it } from 'vitest';
import { canAccess } from './control-acceso';
import { Session } from './contratos-sesion';

const session: Session = {
  accessToken: 'token',
  refreshToken: 'refresh',
  expiration: '2099-01-01T00:00:00Z',
  roles: ['Residente'],
  permisos: ['requerimientos.ver', 'requerimientos.crear'],
};

describe('canAccess', () => {
  it('acepta una coincidencia de permiso', () => {
    expect(canAccess(session, { anyPermission: ['requerimientos.ver'] })).toBe(true);
  });

  it('aplica OR cuando se declaran roles y permisos', () => {
    expect(
      canAccess(session, {
        anyRole: ['Administrador'],
        anyPermission: ['requerimientos.crear'],
      }),
    ).toBe(true);
  });

  it('rechaza sesiones ausentes o sin coincidencias', () => {
    expect(canAccess(null, { anyRole: ['Administrador'] })).toBe(false);
    expect(canAccess(session, { anyRole: ['Administrador'] })).toBe(false);
  });
});
