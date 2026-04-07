import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class MaestraService {
  constructor(private api: ApiService) {}

  especialidades(activo?: boolean | null) {
    const qs = activo === undefined || activo === null ? '' : `?activo=${activo}`;
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/maestra/especialidades${qs}`);
  }

  guardarEspecialidad(dto: any) {
    return dto.idEspecialidad
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/maestra/especialidades/${dto.idEspecialidad}`, dto)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/maestra/especialidades`, dto);
  }

  proyectos(activo?: boolean | null) {
    const qs = activo === undefined || activo === null ? '' : `?activo=${activo}`;
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/maestra/proyectos${qs}`);
  }

  guardarProyecto(dto: any) {
    return dto.idProyecto
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/maestra/proyectos/${dto.idProyecto}`, dto)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/maestra/proyectos`, dto);
  }

  proveedores(activo?: boolean | null, idEspecialidad?: number | null) {
    const params = new URLSearchParams();
    if (activo !== undefined && activo !== null) params.append('activo', String(activo));
    if (idEspecialidad !== undefined && idEspecialidad !== null) params.append('idEspecialidad', String(idEspecialidad));
    const qs = params.toString();
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/maestra/proveedores${qs ? '?' + qs : ''}`);
  }

  proveedor(id: number) {
    return this.api.http.get<any>(`${this.api.baseUrl}/api/maestra/proveedores/${id}`);
  }

  guardarProveedor(dto: any) {
    return dto.idProveedor
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/maestra/proveedores/${dto.idProveedor}`, dto)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/maestra/proveedores`, dto);
  }

  consultaRuc(ruc: string) {
    return this.api.http.get<any>(`${this.api.baseUrl}/api/maestra/proveedores/consulta-ruc/${ruc}`);
  }

  setProveedorEspecialidad(idProveedor: number, dto: any) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/maestra/proveedores/${idProveedor}/especialidades`, dto);
  }

  materiales(activo?: boolean | null, idEspecialidad?: number | null) {
    const params = new URLSearchParams();
    if (activo !== undefined && activo !== null) params.append('activo', String(activo));
    if (idEspecialidad !== undefined && idEspecialidad !== null) params.append('idEspecialidad', String(idEspecialidad));
    const qs = params.toString();
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/maestra/materiales${qs ? '?' + qs : ''}`);
  }

  material(id: number) {
    return this.api.http.get<any>(`${this.api.baseUrl}/api/maestra/materiales/${id}`);
  }

  guardarMaterial(dto: any) {
    const payload = {
      idMaterial: dto.idMaterial ? Number(dto.idMaterial) : null,
      idEspecialidad: dto.idEspecialidad != null ? Number(dto.idEspecialidad) : 0,
      codigo: (dto.codigo ?? '').toString().trim(),
      descripcion: (dto.descripcion ?? '').toString().trim(),
      unidadMedida: (dto.unidadMedida ?? '').toString().trim(),
      stockMinimo: dto.stockMinimo != null && dto.stockMinimo !== ''
        ? Number(dto.stockMinimo)
        : 0,
      activo: !!dto.activo
    };

    return payload.idMaterial
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/maestra/materiales/${payload.idMaterial}`, payload)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/maestra/materiales`, payload);
  }

  unidadesMedida(activo?: boolean | null) {
    const qs = activo === undefined || activo === null ? '' : `?activo=${activo}`;
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/maestra/unidades-medida${qs}`);
  }

  guardarUnidadMedida(dto: any) {
    return dto.idUnidadMedida
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/maestra/unidades-medida/${dto.idUnidadMedida}`, dto)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/maestra/unidades-medida`, dto);
  }
}