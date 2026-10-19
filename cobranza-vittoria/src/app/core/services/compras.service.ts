import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CompraDetalleResponse, CompraFilaSql, FiltrosCompra } from '../../models/compras.models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ComprasService {
  constructor(private api: ApiService) { }

  requerimientos(filters?: any) {
    const params = new URLSearchParams();

    if (filters?.estado)
      params.append('estado', String(filters.estado));

    if (filters?.idEspecialidad !== undefined && filters?.idEspecialidad !== null)
      params.append('idEspecialidad', String(filters.idEspecialidad));

    if (filters?.idProyecto !== undefined && filters?.idProyecto !== null)
      params.append('idProyecto', String(filters.idProyecto));

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

  ordenes(filters?: any) {
    const params = new URLSearchParams();

    if (filters?.estado)
      params.append('estado', String(filters.estado));

    if (filters?.idProveedor !== undefined && filters?.idProveedor !== null)
      params.append('idProveedor', String(filters.idProveedor));

    if (filters?.idProyecto !== undefined && filters?.idProyecto !== null)
      params.append('idProyecto', String(filters.idProyecto));

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

  compras(filters?: FiltrosCompra): Observable<CompraFilaSql[]> {
    let params = new HttpParams();
    if (filters?.aceptada !== undefined && filters.aceptada !== null) {
      params = params.set('aceptada', filters.aceptada);
    }
    if (filters?.idProveedor !== undefined && filters.idProveedor !== null) {
      params = params.set('idProveedor', filters.idProveedor);
    }
    return this.api.http.get<CompraFilaSql[]>(`${this.api.baseUrl}/api/compras/compras`, { params });
  }

  compra(id: number): Observable<CompraDetalleResponse> {
    return this.api.http.get<CompraDetalleResponse>(`${this.api.baseUrl}/api/compras/compras/${id}`);
  }

  pendientesCompra() {
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/compras/compras/pendientes-desde-oc`);
  }

  registrarCompra(dto: any) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/compras/compras`, dto);
  }

  /** Acepta la Compra: libera lo comprometido y ejecuta el gasto en el presupuesto; la OC pasa a ATENDIDA. */
  aceptarCompra(idCompra: number, dto: { idUsuario: number; observacion: string | null }) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/compras/compras/${idCompra}/aceptar`, dto);
  }

  documentosCompra(idCompra: number) {
    return this.api.http.get<any[]>(`${this.api.baseUrl}/api/compras/compras/${idCompra}/documentos`);
  }

  uploadDocumentosCompra(idCompra: number, files: File[]) {
    const formData = new FormData();
    files.forEach((f: File) => formData.append('files', f, f.name));
    return this.api.http.post<any>(`${this.api.baseUrl}/api/compras/compras/${idCompra}/documentos`, formData);
  }

  documentoCompraDownloadUrl(idCompra: number, docId: number) {
    return `${this.api.baseUrl}/api/compras/compras/${idCompra}/documentos/${docId}/download`;
  }
}
