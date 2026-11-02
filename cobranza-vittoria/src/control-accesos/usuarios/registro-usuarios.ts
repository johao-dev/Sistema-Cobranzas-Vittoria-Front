import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../app/core/services/api.service';
import {
  AsignarRolesRequest,
  DetalleUsuario,
  Usuario,
  UsuarioCreateRequest,
  UsuarioUpdateRequest,
} from './contratos-usuarios';
import { leerListaSeguridad } from '../lectura-respuestas-seguridad';
import { leerDetalleUsuario, leerUsuario } from './lectura-usuarios';

@Injectable({ providedIn: 'root' })
export class RegistroUsuarios {
  private readonly api = inject(ApiService);
  private readonly base = `${this.api.baseUrl}/api/seguridad/usuarios`;

  usuarios(activo?: boolean | null): Observable<Usuario[]> {
    const params = activo == null ? new HttpParams() : new HttpParams().set('activo', activo);
    return this.api.http
      .get<unknown>(this.base, { params })
      .pipe(map((res) => leerListaSeguridad(res, ['usuarios', 'Usuarios']).map(leerUsuario)));
  }

  usuario(idUsuario: number): Observable<DetalleUsuario> {
    return this.api.http.get<unknown>(`${this.base}/${idUsuario}`).pipe(map(leerDetalleUsuario));
  }

  crearUsuario(dto: UsuarioCreateRequest): Observable<Usuario> {
    return this.api.http.post<Usuario>(this.base, dto);
  }

  actualizarUsuario(idUsuario: number, dto: UsuarioUpdateRequest): Observable<void> {
    return this.api.http.put<void>(`${this.base}/${idUsuario}`, dto);
  }

  asignarRoles(idUsuario: number, idRoles: number[]): Observable<void> {
    const body: AsignarRolesRequest = {
      idRoles: Array.from(new Set(idRoles.map(Number).filter((id) => id > 0))),
    };
    return this.api.http.post<void>(`${this.base}/${idUsuario}/roles`, body);
  }
}
