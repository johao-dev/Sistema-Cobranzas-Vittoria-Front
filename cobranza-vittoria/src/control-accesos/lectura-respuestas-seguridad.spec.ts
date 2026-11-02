import { leerListaSeguridad } from './lectura-respuestas-seguridad';
import { leerDetalleUsuario, leerUsuario } from './usuarios/lectura-usuarios';
import { leerRol } from './roles/lectura-roles';

const USUARIO = {
  idUsuario: 4,
  nombres: 'Ana',
  apellidos: 'Ruiz',
  correo: 'ana@correo.com',
  usuarioLogin: 'ana',
  activo: false,
  fechaCreacion: null,
  usuarioCreacion: null,
};

describe('Lectura de las respuestas históricas de Seguridad', () => {
  it.each([
    [USUARIO],
    { usuarios: [USUARIO] },
    { Usuarios: [USUARIO] },
    { data: [USUARIO] },
    { data: { usuarios: [USUARIO] } },
    { items: [USUARIO] },
    { Items: [USUARIO] },
    { $values: [USUARIO] },
  ])('conserva las envolturas ya soportadas: %j', (respuesta) => {
    expect(leerListaSeguridad(respuesta, ['usuarios', 'Usuarios']).map(leerUsuario)).toEqual([
      USUARIO,
    ]);
  });

  it.each([null, {}, { usuarios: null }, { data: { message: 'Error' } }])(
    'propaga una respuesta inválida sin presentarla como listado vacío: %j',
    (respuesta) => {
      expect(() => leerListaSeguridad(respuesta, ['usuarios'])).toThrow();
    },
  );

  it.each([USUARIO, { usuario: USUARIO }, { Usuario: USUARIO }])(
    'conserva el detalle, omite hashes y no inventa roles ausentes',
    (respuesta) => {
      expect(leerDetalleUsuario(respuesta)).toEqual({ usuario: USUARIO, roles: [] });
      expect(
        leerDetalleUsuario({
          usuario: { ...USUARIO, passwordHash: 'no mostrar' },
          roles: [{ nombreRol: 'Residente' }],
        }),
      ).toEqual({ usuario: USUARIO, roles: [{ nombreRol: 'Residente' }] });
    },
  );

  it('acepta nombres y campos históricos de roles y conserva activo=false', () => {
    expect(
      leerRol({ IdRol: '3', NombreRol: ' Residente ', Descripcion: 'Obras', Activo: false }),
    ).toMatchObject({ idRol: 3, nombre: 'Residente', descripcion: 'Obras', activo: false });
  });

  it.each([null, { idUsuario: 0 }, { idUsuario: 2, activo: 'false' }])(
    'rechaza identidades y estados inválidos: %j',
    (respuesta) => {
      expect(() => leerUsuario(respuesta)).toThrow();
    },
  );
});
