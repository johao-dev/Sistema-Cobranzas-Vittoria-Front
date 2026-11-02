import { FormControl, ValidatorFn, Validators } from '@angular/forms';
import { UsuarioCreateRequest, UsuarioUpdateRequest } from '../contratos-usuarios';

export interface BorradorUsuario extends UsuarioCreateRequest {
  activo: boolean;
}

export function datosAltaUsuario(form: BorradorUsuario): UsuarioCreateRequest {
  return {
    nombres: form.nombres.trim(),
    apellidos: form.apellidos.trim(),
    correo: form.correo.trim(),
    usuarioLogin: form.usuarioLogin.trim(),
    password: form.password,
  };
}

export function datosEdicionUsuario(form: BorradorUsuario): UsuarioUpdateRequest {
  const datos = datosAltaUsuario(form);
  return {
    nombres: datos.nombres,
    apellidos: datos.apellidos,
    correo: datos.correo,
    usuarioLogin: datos.usuarioLogin,
    activo: form.activo,
    ...(datos.password ? { password: datos.password } : {}),
  };
}

/** El correo se envía recortado; la validación debe aceptar el mismo valor normalizado. */
export const validarCorreoUsuario: ValidatorFn = (control) => {
  const valor: unknown = control.value;
  if (typeof valor !== 'string') return { email: true };
  return Validators.email(new FormControl(valor.trim(), { nonNullable: true }));
};
