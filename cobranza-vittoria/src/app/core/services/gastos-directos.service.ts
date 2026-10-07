import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

export interface CategoriaGasto {
  idCategoriaGasto: number;
  codigo: string;
  nombre: string;
}

export interface CentroCostoGastoDirecto {
  idCentroCosto: number;
  codigo: string;
  nombre: string;
}

export interface PartidaDisponibleGastoDirecto {
  idPresupuestoDetalle: number;
  idCatalogoPartida: number;
  codigoPartida: string;
  nombrePartida: string;
  montoPresupuestado: number;
  montoComprometido: number;
  montoEjecutado: number;
  saldoDisponible: number;
  idMoneda: number;
  codigoMoneda: string;
  simboloMoneda: string;
}

export interface ProveedorGastoDirecto {
  idProveedor: number;
  razonSocial: string;
  ruc?: string | null;
}

export interface GastoDirectoListado {
  idGastoDirecto: number;
  idPresupuestoDetalle: number;
  idCentroCosto: number;
  idCatalogoPartida: number;
  idCategoriaGasto: number | null;
  codigoCategoriaGasto: string | null;
  nombreCategoriaGasto: string | null;
  idProveedor: number | null;
  idMoneda: number;
  fecha: string;
  concepto: string;
  descripcion: string | null;
  monto: number;
  estado: string;
  proveedor?: string | null;
  centroCosto?: string | null;
  codigoPartida?: string | null;
  partida?: string | null;
  moneda?: string | null;
  codigoPresupuesto?: string | null;
  totalDocumentos?: number;
  idMonedaOriginal?: number | null;
  monedaOriginal?: string | null;
  montoOriginal?: number | null;
  tipoCambio?: number | null;
  fechaTipoCambio?: string | null;
}

export interface GastoDirectoRequest {
  idPresupuestoDetalle: number;
  idCategoriaGasto: number;
  idProveedor: number | null;
  idMoneda: number;
  fecha: string;
  concepto: string;
  descripcion: string | null;
  monto: number;
  idMonedaOriginal: number | null;
  montoOriginal: number | null;
  tipoCambio: number | null;
  fechaTipoCambio: string | null;
}

export interface GastoDirectoFiltro {
  estado?: string | null;
  idProveedor?: number | null;
  idCentroCosto?: number | null;
  desde?: string | null;
  hasta?: string | null;
  idCategoriaGasto?: number[] | null;
}

/** Cliente HTTP de Gastos Directos. La categoría clasifica el contexto visual;
 * la imputación económica continúa determinada por idPresupuestoDetalle. */
@Injectable({ providedIn: 'root' })
export class GastosDirectosService {
  private readonly base: string;

  constructor(private api: ApiService) {
    this.base = `${this.api.baseUrl}/api/contable/gastos-directos`;
  }

  listar(filtro: GastoDirectoFiltro = {}) {
    const params = new URLSearchParams();
    Object.entries(filtro).forEach(([clave, valor]) => {
      if (valor === undefined || valor === null || valor === '') return;
      if (Array.isArray(valor)) {
        valor.forEach(item => params.append(clave, String(item)));
        return;
      }
      params.append(clave, String(valor));
    });
    const qs = params.toString();
    return this.api.http.get<GastoDirectoListado[]>(`${this.base}${qs ? '?' + qs : ''}`);
  }

  categorias() {
    return this.api.http.get<CategoriaGasto[]>(`${this.base}/categorias`);
  }

  centrosCosto() {
    return this.api.http.get<CentroCostoGastoDirecto[]>(`${this.base}/centros-costo`);
  }

  proveedores() {
    return this.api.http.get<ProveedorGastoDirecto[]>(`${this.base}/proveedores`);
  }

  partidasDisponibles(idCentroCosto: number) {
    return this.api.http.get<PartidaDisponibleGastoDirecto[]>(
      `${this.base}/partidas-disponibles?idCentroCosto=${idCentroCosto}`);
  }

  obtener(id: number) {
    return this.api.http.get<GastoDirectoListado>(`${this.base}/${id}`);
  }

  crear(dto: GastoDirectoRequest) {
    return this.api.http.post<GastoDirectoListado>(this.base, this.payload(dto));
  }

  actualizar(id: number, dto: GastoDirectoRequest) {
    return this.api.http.put<GastoDirectoListado>(`${this.base}/${id}`, this.payload(dto));
  }

  confirmar(id: number) {
    return this.api.http.post<GastoDirectoListado>(`${this.base}/${id}/confirmar`, {});
  }

  anular(id: number) {
    return this.api.http.post<GastoDirectoListado>(`${this.base}/${id}/anular`, {});
  }

  documentos(id: number) {
    return this.api.http.get<any[]>(`${this.base}/${id}/documentos`);
  }

  subirDocumentos(id: number, tipoDocumento: 'Factura' | 'Pago', files: File[]) {
    const formData = new FormData();
    formData.append('tipoDocumento', tipoDocumento);
    files.forEach(file => formData.append('files', file, file.name));
    return this.api.http.post<any>(`${this.base}/${id}/documentos`, formData);
  }

  documentoDownloadUrl(id: number, idDocumento: number): string {
    return `${this.base}/${id}/documentos/${idDocumento}/download`;
  }

  /** Descarga autenticada; un enlace directo no incluiría el token de sesión. */
  descargarDocumento(id: number, idDocumento: number) {
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
      fechaTipoCambio: dto.fechaTipoCambio || null
    };
  }
}
