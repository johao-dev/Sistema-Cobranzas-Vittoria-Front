import { Rol } from './contratos-roles';
import {
  esRegistro,
  leerActivo,
  leerIdentificador,
  leerTexto,
} from '../lectura-respuestas-seguridad';

export function leerRol(valor: unknown): Rol {
  if (!esRegistro(valor)) throw new Error('Detalle de rol inválido.');
  return {
    idRol: leerIdentificador(valor, 'idRol', 'IdRol'),
    nombre:
      leerTexto(valor, 'nombreRol', 'NombreRol', 'nombre', 'Nombre').trim() || 'Rol sin nombre',
    descripcion: leerTexto(valor, 'descripcion', 'Descripcion'),
    activo: leerActivo(valor),
    fechaCreacion: leerTexto(valor, 'fechaCreacion', 'FechaCreacion') || null,
    usuarioCreacion: leerTexto(valor, 'usuarioCreacion', 'UsuarioCreacion') || null,
    fechaModificacion: leerTexto(valor, 'fechaModificacion', 'FechaModificacion') || null,
    usuarioModificacion: leerTexto(valor, 'usuarioModificacion', 'UsuarioModificacion') || null,
  };
}
