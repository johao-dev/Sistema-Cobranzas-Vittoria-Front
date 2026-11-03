import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiHttp } from '../core/http/api-http';
import {
  CategoriaGasto,
  CentroCostoGastoDirecto,
  PartidaDisponibleGastoDirecto,
  ProveedorGastoDirecto,
  GastoDirectoListado,
  GastoDirectoDocumento,
  GastoDirectoRequest,
  GastoDirectoFiltro,
  GastoDirectoDetalle,
  GastoDirectoGuardado,
  GastoDirectoTransicion,
  DocumentosGastoAdjuntados,
} from './contratos-gastos-directos';

/** Cliente HTTP de Gastos Directos. La categoría clasifica el gasto;
 * la imputación económica continúa determinada por idPresupuestoDetalle. */
@Injectable({ providedIn: 'root' })
export class RegistroGastosDirectos {
  private readonly api = inject(ApiHttp);
  private readonly base = `${this.api.baseUrl}/api/contable/gastos-directos`;

  listar(filtro: GastoDirectoFiltro = {}): Observable<GastoDirectoListado[]> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor === undefined || valor === null || valor === '') continue;
      for (const item of Array.isArray(valor) ? valor : [valor]) {
        params = params.append(clave, String(item));
      }
    }
    return this.api.http.get<GastoDirectoListado[]>(this.base, { params });
  }

  categorias(): Observable<CategoriaGasto[]> {
    return this.api.http.get<CategoriaGasto[]>(`${this.base}/categorias`);
  }

  centrosCosto(): Observable<CentroCostoGastoDirecto[]> {
    return this.api.http.get<CentroCostoGastoDirecto[]>(`${this.base}/centros-costo`);
  }

  proveedores(): Observable<ProveedorGastoDirecto[]> {
    return this.api.http.get<ProveedorGastoDirecto[]>(`${this.base}/proveedores`);
  }

  partidasDisponibles(idCentroCosto: number): Observable<PartidaDisponibleGastoDirecto[]> {
    return this.api.http.get<PartidaDisponibleGastoDirecto[]>(`${this.base}/partidas-disponibles`, {
      params: new HttpParams().set('idCentroCosto', idCentroCosto),
    });
  }

  obtener(id: number): Observable<GastoDirectoDetalle> {
    return this.api.http.get<GastoDirectoDetalle>(`${this.base}/${id}`);
  }

  crear(dto: GastoDirectoRequest): Observable<GastoDirectoGuardado> {
    return this.api.http.post<GastoDirectoGuardado>(this.base, this.payload(dto));
  }

  actualizar(id: number, dto: GastoDirectoRequest): Observable<GastoDirectoGuardado> {
    return this.api.http.put<GastoDirectoGuardado>(`${this.base}/${id}`, this.payload(dto));
  }

  confirmar(id: number): Observable<GastoDirectoTransicion> {
    return this.api.http.post<GastoDirectoTransicion>(`${this.base}/${id}/confirmar`, {});
  }

  anular(id: number): Observable<GastoDirectoTransicion> {
    return this.api.http.post<GastoDirectoTransicion>(`${this.base}/${id}/anular`, {});
  }

  documentos(id: number): Observable<GastoDirectoDocumento[]> {
    return this.api.http.get<GastoDirectoDocumento[]>(`${this.base}/${id}/documentos`);
  }

  subirDocumentos(
    id: number,
    tipoDocumento: 'Factura' | 'Pago',
    files: File[],
  ): Observable<DocumentosGastoAdjuntados> {
    const formData = new FormData();
    formData.append('tipoDocumento', tipoDocumento);
    files.forEach((file) => formData.append('files', file, file.name));
    return this.api.http.post<DocumentosGastoAdjuntados>(`${this.base}/${id}/documentos`, formData);
  }

  documentoDownloadUrl(id: number, idDocumento: number): string {
    return `${this.base}/${id}/documentos/${idDocumento}/download`;
  }

  /** Descarga autenticada; un enlace directo no incluiría el token de sesión. */
  descargarDocumento(id: number, idDocumento: number): Observable<Blob> {
    return this.api.http.get(this.documentoDownloadUrl(id, idDocumento), { responseType: 'blob' });
  }

  private payload(dto: GastoDirectoRequest): GastoDirectoRequest {
    return {
      idPresupuestoDetalle: Number(dto.idPresupuestoDetalle),
      idCategoriaGasto: Number(dto.idCategoriaGasto),
      idProveedor: dto.idProveedor != null ? Number(dto.idProveedor) : null,
      idMoneda: Number(dto.idMoneda),
      fecha: dto.fecha,
      concepto: (dto.concepto ?? '').toString().trim(),
      descripcion: (dto.descripcion ?? '').toString().trim() || null,
      monto: Number(dto.monto ?? 0),
      idMonedaOriginal: dto.idMonedaOriginal != null ? Number(dto.idMonedaOriginal) : null,
      montoOriginal: dto.montoOriginal != null ? Number(dto.montoOriginal) : null,
      tipoCambio: dto.tipoCambio != null ? Number(dto.tipoCambio) : null,
      fechaTipoCambio: dto.fechaTipoCambio || null,
    };
  }
}
