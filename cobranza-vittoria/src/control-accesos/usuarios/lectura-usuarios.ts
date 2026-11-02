import { DetalleUsuario, Usuario } from './contratos-usuarios';
import {
  esRegistro,
  leerActivo,
  leerIdentificador,
  leerTexto,
} from '../lectura-respuestas-seguridad';

export function leerUsuario(valor: unknown): Usuario {
  if (!esRegistro(valor)) throw new Error('Detalle de usuario inválido.');
  return {
    idUsuario: leerIdentificador(valor, 'idUsuario', 'IdUsuario'),
    nombres: leerTexto(valor, 'nombres', 'Nombres'),
    apellidos: leerTexto(valor, 'apellidos', 'Apellidos'),
    correo: leerTexto(valor, 'correo', 'Correo'),
    usuarioLogin: leerTexto(valor, 'usuarioLogin', 'UsuarioLogin'),
    activo: leerActivo(valor),
    fechaCreacion: leerTexto(valor, 'fechaCreacion', 'FechaCreacion') || null,
    usuarioCreacion: leerTexto(valor, 'usuarioCreacion', 'UsuarioCreacion') || null,
  };
}

/** Conserva la lectura actual de usuario/Usuario y de roles sin declararlos contrato de API. */
export function leerDetalleUsuario(respuesta: unknown): DetalleUsuario {
  if (!esRegistro(respuesta)) throw new Error('Detalle de usuario inválido.');
  const usuario = leerUsuario(respuesta['usuario'] ?? respuesta['Usuario'] ?? respuesta);
  const roles: unknown[] = Array.isArray(respuesta['roles']) ? respuesta['roles'] : [];
  return {
    usuario,
    roles: roles.filter(esRegistro).map((rol) => ({ nombreRol: leerTexto(rol, 'nombreRol') })),
  };
}
