import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ComprasService {
  constructor(private api: ApiService) {}

  // REQUERIMIENTOS
  requerimientos(filters?: any) {
    const params = new URLSearchParams();
    if (filters?.estado) params.append('estado', String(filters.estado));
    if (filters?.idEspecialidad !== undefined && filters?.idEspecialidad !== null) {
      params.append('idEspecialidad', String(filters.idEspecialidad));
    }
    if (filters?.idProyecto !== undefined && filters?.idProyecto !== null) {
      params.append('idProyecto', String(filters.idProyecto));
    }
    const qs = params.toString();
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/compras/requerimientos${qs ? '?' + qs : ''}`);
  }

  requerimiento(id: number) {
    return this.api.http.get<any>(`${this.api.baseUrl}/api/compras/requerimientos/${id}`);
  }

  crearRequerimiento(dto: any) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/compras/requerimientos`, dto);
  }

  actualizarRequerimiento(id: number, dto: any) {
    return this.api.http.put<any>(`${this.api.baseUrl}/api/compras/requerimientos/${id}`, dto);
  }

  actualizarEstadoRequerimiento(id: number, dto: any) {
    return this.api.http.patch<any>(`${this.api.baseUrl}/api/compras/requerimientos/${id}/estado`, dto);
  }

  enviarAOrdenCompra(id: number, idUsuario: number | null, observacion?: string) {
    return this.api.http.patch<any>(`${this.api.baseUrl}/api/compras/requerimientos/${id}/estado`, {
      estado: 'EnviadoOC',
      observacion: observacion || '',
      idUsuario
    });
  }

  // ORDENES DE COMPRA
  ordenes(filters?: any) {
    const params = new URLSearchParams();
    if (filters?.estado) params.append('estado', String(filters.estado));
    if (filters?.idProveedor !== undefined && filters?.idProveedor !== null) {
      params.append('idProveedor', String(filters.idProveedor));
    }
    if (filters?.idProyecto !== undefined && filters?.idProyecto !== null) {
      params.append('idProyecto', String(filters.idProyecto));
    }
    const qs = params.toString();
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/compras/ordenes-compra${qs ? '?' + qs : ''}`);
  }

  orden(id: number) {
    return this.api.http.get<any>(`${this.api.baseUrl}/api/compras/ordenes-compra/${id}`);
  }

  crearOrden(dto: any) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/compras/ordenes-compra`, dto);
  }

  actualizarOrden(id: number, dto: any) {
    return this.api.http.put<any>(`${this.api.baseUrl}/api/compras/ordenes-compra/${id}`, dto);
  }

  actualizarEstadoOrden(id: number, dto: any) {
    return this.api.http.patch<any>(`${this.api.baseUrl}/api/compras/ordenes-compra/${id}/estado`, dto);
  }

  // COMPRAS
  compras(filters?: any) {
    const params = new URLSearchParams();
    if (filters?.aceptada !== undefined && filters?.aceptada !== null) {
      params.append('aceptada', String(filters.aceptada));
    }
    if (filters?.idProveedor !== undefined && filters?.idProveedor !== null) {
      params.append('idProveedor', String(filters.idProveedor));
    }
    const qs = params.toString();
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/compras/compras${qs ? '?' + qs : ''}`);
  }

  compra(id: number) {
    return this.api.http.get<any>(`${this.api.baseUrl}/api/compras/compras/${id}`);
  }

  pendientesCompra() {
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/compras/compras/pendientes-desde-oc`);
  }

  registrarCompra(dto: any) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/compras/compras`, dto);
  }

  aceptarCompra(id: number) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/compras/compras/${id}/aceptar`, {});
  }

  documentosCompra(idCompra: number) {
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/compras/compras/${idCompra}/documentos`);
  }

  uploadDocumentosCompra(idCompra: number, files: File[]) {
    const formData = new FormData();
    files.forEach((f: File) => formData.append('files', f, f.name));
    return this.api.http.post<any>(`${this.api.baseUrl}/api/compras/compras/${idCompra}/documentos`, formData);
  }
}
