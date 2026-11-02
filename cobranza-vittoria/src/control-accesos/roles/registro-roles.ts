import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../app/core/services/api.service';
import {
  ActualizarRolRequest,
  AsignarPermisosRolRequest,
  CrearRolRequest,
  Rol,
  RolConPermisosResponse,
} from './contratos-roles';
import { leerListaSeguridad } from '../lectura-respuestas-seguridad';
import { leerRol } from './lectura-roles';

@Injectable({ providedIn: 'root' })
export class RegistroRoles {
  private readonly api = inject(ApiService);
  private readonly base = `${this.api.baseUrl}/api/seguridad/roles`;

  roles(activo?: boolean | null): Observable<Rol[]> {
    const params = activo == null ? new HttpParams() : new HttpParams().set('activo', activo);
    return this.api.http
      .get<unknown>(this.base, { params })
      .pipe(map((res) => leerListaSeguridad(res, ['roles', 'Roles']).map(leerRol)));
  }

  crearRol(dto: CrearRolRequest): Observable<Rol> {
    return this.api.http.post<Rol>(this.base, dto);
  }
  actualizarRol(idRol: number, dto: ActualizarRolRequest): Observable<void> {
    return this.api.http.put<void>(`${this.base}/${idRol}`, dto);
  }

  obtenerRolConPermisos(idRol: number): Observable<RolConPermisosResponse> {
    return this.api.http.get<RolConPermisosResponse>(`${this.base}/${idRol}/permisos`);
  }

  asignarPermisosRol(idRol: number, idPermisos: number[]): Observable<void> {
    const body: AsignarPermisosRolRequest = { idPermisos: Array.from(new Set(idPermisos)) };
    return this.api.http.post<void>(`${this.base}/${idRol}/permisos`, body);
  }

  quitarPermisoRol(idRol: number, idPermiso: number): Observable<void> {
    return this.api.http.delete<void>(`${this.base}/${idRol}/permisos/${idPermiso}`);
  }
}
