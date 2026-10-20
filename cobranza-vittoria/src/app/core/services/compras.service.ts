import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CompraDetalleResponse, CompraFilaSql, FiltrosCompra } from '../../models/compras.models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ComprasService {
  constructor(private api: ApiService) { }

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
