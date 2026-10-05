import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

export interface GastoDirectoFiltro {
  estado?: string | null;
  idProveedor?: number | null;
  idCentroCosto?: number | null;
  desde?: string | null;
  hasta?: string | null;
  /** Sección de Gastos del proyecto: ADMINISTRATIVO, TERRENO, MARKETING_VENTAS, OTROS o MUNICIPAL. */
  seccion?: string | null;
}

/**
 * Gastos directos del módulo Contable. Cada gasto se imputa a una partida
 * presupuestal: CONFIRMADO registra una EJECUCIÓN y ANULADO devuelve el monto
 * mediante un AJUSTE. El estado lo resuelve el backend.
 */
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
      params.append(clave, String(valor));
    });
    const qs = params.toString();
    return this.api.http.get<any[]>(`${this.base}${qs ? '?' + qs : ''}`);
  }

  /** Centros de costo que admite la sección (por tipo de centro de costo). */
  centrosCosto(seccion: string) {
    return this.api.http.get<any[]>(`${this.base}/centros-costo?seccion=${encodeURIComponent(seccion)}`);
  }

  /** Proveedores activos: primero los de la sección (deLaSeccion), luego el resto del catálogo. */
  proveedores(seccion: string) {
    return this.api.http.get<any[]>(`${this.base}/proveedores?seccion=${encodeURIComponent(seccion)}`);
  }

  /** Partidas de la sección con su saldo vigente en el presupuesto aprobado del centro de costo. */
  partidasDisponibles(seccion: string, idCentroCosto: number) {
    return this.api.http.get<any[]>(
      `${this.base}/partidas-disponibles?seccion=${encodeURIComponent(seccion)}&idCentroCosto=${idCentroCosto}`);
  }

  obtener(id: number) {
    return this.api.http.get<any>(`${this.base}/${id}`);
  }

  crear(dto: any) {
    return this.api.http.post<any>(this.base, this.payload(dto));
  }

  actualizar(id: number, dto: any) {
    return this.api.http.put<any>(`${this.base}/${id}`, this.payload(dto));
  }

  confirmar(id: number) {
    return this.api.http.post<any>(`${this.base}/${id}/confirmar`, {});
  }

  anular(id: number) {
    return this.api.http.post<any>(`${this.base}/${id}/anular`, {});
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

  /**
   * Descarga autenticada: el endpoint exige sesión, así que un enlace directo
   * (sin el token) respondería 401.
   */
  descargarDocumento(id: number, idDocumento: number) {
    return this.api.http.get(this.documentoDownloadUrl(id, idDocumento), { responseType: 'blob' });
  }

  private payload(dto: any) {
    return {
      idPresupuestoDetalle: Number(dto.idPresupuestoDetalle),
      idProveedor: dto.idProveedor != null && dto.idProveedor !== '' ? Number(dto.idProveedor) : null,
      idMoneda: Number(dto.idMoneda),
      fecha: dto.fecha,
      concepto: (dto.concepto ?? '').toString().trim(),
      descripcion: (dto.descripcion ?? '').toString().trim() || null,
      monto: Number(dto.monto ?? 0),
      seccion: dto.seccion || null,
      // Factura en otra moneda: solo referencia, las tres juntas o ninguna.
      idMonedaOriginal: dto.facturaOtraMoneda && dto.idMonedaOriginal ? Number(dto.idMonedaOriginal) : null,
      montoOriginal: dto.facturaOtraMoneda && dto.montoOriginal ? Number(dto.montoOriginal) : null,
      tipoCambio: dto.facturaOtraMoneda && dto.tipoCambio ? Number(dto.tipoCambio) : null,
      fechaTipoCambio: dto.facturaOtraMoneda && dto.fechaTipoCambio ? dto.fechaTipoCambio : null
    };
  }
}
