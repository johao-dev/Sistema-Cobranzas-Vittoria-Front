import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CompraDetalleResponse,
  CompraFilaSql,
  FiltrosCompra,
  CompraPendienteOcFilaSql,
  CompraRequest,
  CompraCreada,
  AceptarCompraRequest,
  CompraDocumentoFilaSql,
} from './contratos-compras';
import { ApiService } from '../app/core/services/api.service';

@Injectable({ providedIn: 'root' })
export class RegistroCompras {
  private readonly api = inject(ApiService);

  compras(filters?: FiltrosCompra): Observable<CompraFilaSql[]> {
    let params = new HttpParams();
    if (filters?.aceptada !== undefined && filters.aceptada !== null) {
      params = params.set('aceptada', filters.aceptada);
    }
    if (filters?.idProveedor !== undefined && filters.idProveedor !== null) {
      params = params.set('idProveedor', filters.idProveedor);
    }
    return this.api.http.get<CompraFilaSql[]>(`${this.api.baseUrl}/api/compras/compras`, {
      params,
    });
  }

  compra(id: number): Observable<CompraDetalleResponse> {
    return this.api.http.get<CompraDetalleResponse>(
      `${this.api.baseUrl}/api/compras/compras/${id}`,
    );
  }

  pendientesCompra(): Observable<CompraPendienteOcFilaSql[]> {
    return this.api.http.get<CompraPendienteOcFilaSql[]>(
      `${this.api.baseUrl}/api/compras/compras/pendientes-desde-oc`,
    );
  }

  registrarCompra(dto: CompraRequest): Observable<CompraCreada> {
    return this.api.http.post<CompraCreada>(`${this.api.baseUrl}/api/compras/compras`, dto);
  }

  /** Acepta la Compra: libera lo comprometido y ejecuta el gasto en el presupuesto; la OC pasa a ATENDIDA. */
  aceptarCompra(idCompra: number, dto: AceptarCompraRequest): Observable<{ ok: boolean }> {
    return this.api.http.post<{ ok: boolean }>(
      `${this.api.baseUrl}/api/compras/compras/${idCompra}/aceptar`,
      dto,
    );
  }

  documentosCompra(idCompra: number): Observable<CompraDocumentoFilaSql[]> {
    return this.api.http.get<CompraDocumentoFilaSql[]>(
      `${this.api.baseUrl}/api/compras/compras/${idCompra}/documentos`,
    );
  }

  uploadDocumentosCompra(idCompra: number, files: File[]): Observable<{ ok: boolean }> {
    const formData = new FormData();
    files.forEach((f: File) => formData.append('files', f, f.name));
    return this.api.http.post<{ ok: boolean }>(
      `${this.api.baseUrl}/api/compras/compras/${idCompra}/documentos`,
      formData,
    );
  }

  documentoCompraDownloadUrl(idCompra: number, docId: number): string {
    return `${this.api.baseUrl}/api/compras/compras/${idCompra}/documentos/${docId}/download`;
  }
}
