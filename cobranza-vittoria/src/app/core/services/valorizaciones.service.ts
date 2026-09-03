import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ValorizacionesService {
  constructor(private api: ApiService) { }

  configuraciones(filters?: any) {
    const params = new URLSearchParams();
    if (filters?.idProyecto !== undefined && filters?.idProyecto !== null) params.append('idProyecto', String(filters.idProyecto));
    if (filters?.idProveedor !== undefined && filters?.idProveedor !== null) params.append('idProveedor', String(filters.idProveedor));
    if (filters?.idEspecialidad !== undefined && filters?.idEspecialidad !== null) params.append('idEspecialidad', String(filters.idEspecialidad));
    const qs = params.toString();
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/contable/valorizaciones/configuraciones${qs ? '?' + qs : ''}`);
  }

  guardarConfiguracion(dto: any) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/contable/valorizaciones/configuraciones`, dto);
  }

  guardarReglaProveedor(dto: any) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/contable/valorizaciones/reglas-proveedor`, dto);
  }

  valorizaciones(filters?: any) {
    const params = new URLSearchParams();
    if (filters?.idProyecto !== undefined && filters?.idProyecto !== null) params.append('idProyecto', String(filters.idProyecto));
    if (filters?.idProveedor !== undefined && filters?.idProveedor !== null) params.append('idProveedor', String(filters.idProveedor));
    if (filters?.idEspecialidad !== undefined && filters?.idEspecialidad !== null) params.append('idEspecialidad', String(filters.idEspecialidad));
    const qs = params.toString();
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/contable/valorizaciones${qs ? '?' + qs : ''}`);
  }

  valorizacion(id: number) {
    return this.api.http.get<any>(`${this.api.baseUrl}/api/contable/valorizaciones/${id}`);
  }

  valorizacionPorConfiguracion(idConfiguracion: number) {
    return this.api.http.get<any>(`${this.api.baseUrl}/api/contable/valorizaciones/configuracion/${idConfiguracion}`);
  }

  guardarValorizacion(dto: any) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/contable/valorizaciones`, dto);
  }

  guardarDetalle(dto: any) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/contable/valorizaciones/detalle`, dto);
  }

  eliminarDetalle(idDetalle: number, usuario = 'system') {
    return this.api.http.delete<any>(`${this.api.baseUrl}/api/contable/valorizaciones/detalle/${idDetalle}?usuario=${encodeURIComponent(usuario)}`);
  }

  uploadDetalleArchivos(idDetalle: number, files: File[]) {
    const formData = new FormData();
    files.forEach((f: File) => formData.append('files', f, f.name));
    return this.api.http.post<any>(`${this.api.baseUrl}/api/contable/valorizaciones/detalle/${idDetalle}/archivos`, formData);
  }

  downloadDetalleArchivoUrl(idDetalle: number, idArchivo: number) {
    return `${this.api.baseUrl}/api/contable/valorizaciones/detalle/${idDetalle}/archivos/${idArchivo}/download`;
  }
}
