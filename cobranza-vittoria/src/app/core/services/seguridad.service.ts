import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { ApiService } from './api.service';
import { ListarPermisoResponse, Permiso, UpdatePermisoRequest } from '../../models/permisos.models';
import { AsignarRolesRequest, UsuarioCreateRequest, UsuarioUpdateRequest } from '../../models/usuarios.models';
import { AsignarPermisosRolRequest, RolConPermisosResponse } from '../../models/roles.models';
import { map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SeguridadService {
  constructor(private api: ApiService) { }

  permisos(activo?: boolean | null) {
    const params = activo == null ? new HttpParams() : new HttpParams().set('activo', activo);
    return this.api.http.get<ListarPermisoResponse>(`${this.api.baseUrl}/api/seguridad/permisos`, { params });
  }

  permisoPorId(id: number) {
    return this.api.http.get<Permiso>(`${this.api.baseUrl}/api/seguridad/permisos/${id}`);
  }

  actualizarPermiso(id: number, dto: UpdatePermisoRequest) {
    return this.api.http.put<void>(`${this.api.baseUrl}/api/seguridad/permisos/${id}`, dto);
  }

  habilitarPermiso(id: number) {
    return this.api.http.patch<void>(`${this.api.baseUrl}/api/seguridad/permisos/${id}/enable`, null);
  }

  deshabilitarPermiso(id: number) {
    return this.api.http.patch<void>(`${this.api.baseUrl}/api/seguridad/permisos/${id}/disable`, null);
  }

  roles(activo?: boolean | null) {
    const qs = activo === undefined || activo === null ? '' : `?activo=${activo}`;
    return this.api.http.get<unknown>(`${this.api.baseUrl}/api/seguridad/roles${qs}`).pipe(
      map(response => this.extractList(response, ['roles', 'Roles']))
    );
  }

  guardarRol(dto: any) {
    return dto.idRol
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/seguridad/roles/${dto.idRol}`, dto)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/seguridad/roles`, dto);
  }

  obtenerRolConPermisos(idRol: number) {
    return this.api.http.get<RolConPermisosResponse>(
      `${this.api.baseUrl}/api/seguridad/roles/${idRol}/permisos`
    );
  }

  asignarPermisosRol(idRol: number, idPermisos: number[]) {
    const body: AsignarPermisosRolRequest = { idPermisos: Array.from(new Set(idPermisos)) };
    return this.api.http.post<void>(`${this.api.baseUrl}/api/seguridad/roles/${idRol}/permisos`, body);
  }

  quitarPermisoRol(idRol: number, idPermiso: number) {
    return this.api.http.delete<void>(`${this.api.baseUrl}/api/seguridad/roles/${idRol}/permisos/${idPermiso}`);
  }
  usuarios(activo?: boolean | null) {
    const qs = activo === undefined || activo === null ? '' : `?activo=${activo}`;
    return this.api.http.get<unknown>(`${this.api.baseUrl}/api/seguridad/usuarios${qs}`).pipe(
      map(response => this.extractList(response, ['usuarios', 'Usuarios']))
    );
  }
  usuario(id: number) { return this.api.http.get<any>(`${this.api.baseUrl}/api/seguridad/usuarios/${id}`); }
  crearUsuario(dto: UsuarioCreateRequest) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/seguridad/usuarios`, dto);
  }
  actualizarUsuario(id: number, dto: UsuarioUpdateRequest) {
    return this.api.http.put<any>(`${this.api.baseUrl}/api/seguridad/usuarios/${id}`, dto);
  }
  asignarRoles(idUsuario: number, idRoles: number[]) {
    const request: AsignarRolesRequest = { idRoles: Array.from(new Set(idRoles.map(Number).filter(id => id > 0))) };
    return this.api.http.post<void>(`${this.api.baseUrl}/api/seguridad/usuarios/${idUsuario}/roles`, request);
  }

  private extractList(response: unknown, propertyNames: string[]): any[] {
    if (Array.isArray(response)) return response;
    if (!response || typeof response !== 'object') return [];

    const root = response as Record<string, unknown>;
    if (Array.isArray(root['data'])) return root['data'];
    const containers = [root, root['data']].filter(
      (value): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
    );

    // Se toleran las envolturas usadas por los controladores y `$values` de serialización .NET.
    for (const container of containers) {
      for (const name of [...propertyNames, 'items', 'Items', '$values']) {
        const value = container[name];
        if (Array.isArray(value)) return value;
      }
    }

    return [];
  }
}
