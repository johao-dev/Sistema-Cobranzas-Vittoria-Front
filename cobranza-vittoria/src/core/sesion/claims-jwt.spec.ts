import { describe, expect, it } from 'vitest';
import { decodeJwtPayload, sessionFromTokens } from './claims-jwt';
import { Session } from './contratos-sesion';

function tokenFor(payload: unknown): string {
  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `header.${encoded}.signature`;
}

describe('sessionFromTokens', () => {
  it('normaliza claims largos y arreglos', () => {
    const token = tokenFor({
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': '42',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'residente01',
      'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': ['Residente', 'Comprador'],
      permission: ['requerimientos.ver', 'requerimientos.crear'],
    });

    const session = sessionFromTokens(token, 'refresh', '2099-01-01T00:00:00Z');
    expect(session.idUsuario).toBe(42);
    expect(session.usuarioLogin).toBe('residente01');
    expect(session.roles).toEqual(['Residente', 'Comprador']);
    expect(session.permisos).toEqual(['requerimientos.ver', 'requerimientos.crear']);
  });

  it('convierte claims cortos únicos en arreglos', () => {
    const session = sessionFromTokens(
      tokenFor({
        nameid: '7',
        unique_name: 'almacen01',
        role: 'Almacenero',
        permission: 'requerimientos.ver',
      }),
      'refresh',
      '2099-01-01T00:00:00Z',
    );

    expect(session.roles).toEqual(['Almacenero']);
    expect(session.permisos).toEqual(['requerimientos.ver']);
  });
  it.each([null, [], 'texto', 123, true])(
    'descarta payloads JWT que no sean objetos: %s',
    (payload: unknown) => {
      expect(decodeJwtPayload(tokenFor(payload))).toEqual({});
    },
  );

  it.each(['sin-segmentos', 'cabecera.%%%.firma', 'cabecera.bm8tZXMtanNvbg.firma'])(
    'un JWT ilegible no interrumpe la restauración: %s',
    (token: string) => {
      const session: Session = sessionFromTokens(token, 'refresh', '2099-01-01T00:00:00Z');
      expect(session.roles).toEqual([]);
      expect(session.permisos).toEqual([]);
    },
  );

  it('decodifica claims con caracteres UTF-8', () => {
    const session: Session = sessionFromTokens(
      tokenFor({ name: 'José Pérez' }),
      'refresh',
      '2099-01-01T00:00:00Z',
    );
    expect(session.usuarioLogin).toBe('José Pérez');
  });

  it('ignora roles y permisos de tipos ajenos al contrato', () => {
    const session: Session = sessionFromTokens(
      tokenFor({
        role: ['Residente', null, { rol: 'Administrador' }],
        permission: [123, 'requerimientos.ver'],
      }),
      'refresh',
      '2099-01-01T00:00:00Z',
    );
    expect(session.roles).toEqual(['Residente']);
    expect(session.permisos).toEqual(['requerimientos.ver']);
  });
});
