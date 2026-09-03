import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { CreatePermisoRequest, ListarPermisoResponse, Permiso, UpdatePermisoRequest } from '../../models/permisos.models';

@Injectable({ providedIn: 'root' })
export class SeguridadService {
  constructor(private api: ApiService) { }

  permisos(activo?: boolean | null) {
    const qs = activo === undefined || activo === null ? '' : `?activo=${activo}`;
    return this.api.http.get<ListarPermisoResponse>(`${this.api.baseUrl}/api/seguridad/permisos${qs}`);
  }

  permisoPorId(id: number) {
    return this.api.http.get<Permiso>(`${this.api.baseUrl}/api/seguridad/permisos/${id}`);
  }

  crearPermiso(dto: CreatePermisoRequest) {
    return this.api.http.post<Permiso>(`${this.api.baseUrl}/api/seguridad/permisos`, dto);
  }

  actualizarPermiso(id: number, dto: UpdatePermisoRequest) {
    return this.api.http.put<void>(`${this.api.baseUrl}/api/seguridad/permisos/${id}`, dto);
  }

  eliminarPermiso(id: number) {
    return this.api.http.delete<void>(`${this.api.baseUrl}/api/seguridad/permisos/${id}`);
  }

  roles(activo?: boolean | null) {
    const qs = activo === undefined || activo === null ? '' : `?activo=${activo}`;
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/seguridad/roles${qs}`);
  }

  guardarRol(dto: any) {
    return dto.idRol
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/seguridad/roles/${dto.idRol}`, dto)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/seguridad/roles`, dto);
  }
  usuarios(activo?: boolean | null) {
    const qs = activo === undefined || activo === null ? '' : `?activo=${activo}`;
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/seguridad/usuarios${qs}`);
  }
  usuario(id: number) { return this.api.http.get<any>(`${this.api.baseUrl}/api/seguridad/usuarios/${id}`); }
  crearUsuario(dto: any) { return this.api.http.post<any>(`${this.api.baseUrl}/api/seguridad/usuarios`, dto); }
  actualizarUsuario(id: number, dto: any) { return this.api.http.put<any>(`${this.api.baseUrl}/api/seguridad/usuarios/${id}`, dto); }
  asignarRol(id: number, idRol: number) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/seguridad/usuarios/${id}/roles`, { idUsuario: id, idRol });
  }
}
