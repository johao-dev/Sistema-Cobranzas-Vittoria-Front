import { Injectable, inject } from '@angular/core';
import { HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ApiService } from '../app/core/services/api.service';
import { FiltrosStockProyecto, StockProyecto } from './stock/contratos-stock-proyecto';
import {
  KardexEntradaCreateDto,
  KardexEntradaResponseDto,
  KardexFiltroInventarioDto,
  KardexSalidaCreateDto,
  KardexSalidaResponseDto,
  KardexStockActualResponseDto,
  KardexStockFiltroDto,
} from './contratos-inventario';

@Injectable({ providedIn: 'root' })
export class RegistroInventario {
  private readonly base = '/api/almacen/kardex';

  private readonly api = inject(ApiService);

  listarEntradas(filtros?: KardexFiltroInventarioDto): Observable<KardexEntradaResponseDto[]> {
    const params = this.construirQueryParams({
      idEspecialidad: filtros?.idEspecialidad,
      idProveedor: filtros?.idProveedor,
      idProyecto: filtros?.idProyecto,
      fechaDesde: filtros?.fechaDesde,
      fechaHasta: filtros?.fechaHasta,
    });

    return this.api.http.get<KardexEntradaResponseDto[]>(
      `${this.api.baseUrl}${this.base}/entradas`,
      { params },
    );
  }

  crearEntrada(dto: KardexEntradaCreateDto): Observable<KardexEntradaResponseDto> {
    return this.api.http.post<KardexEntradaResponseDto>(
      `${this.api.baseUrl}${this.base}/entradas`,
      dto,
    );
  }

  actualizarEntrada(id: number, dto: KardexEntradaCreateDto): Observable<KardexEntradaResponseDto> {
    return this.api.http.put<KardexEntradaResponseDto>(
      `${this.api.baseUrl}${this.base}/entradas/${id}`,
      dto,
    );
  }

  eliminarEntrada(id: number): Observable<{ ok: boolean }> {
    return this.api.http.delete<{ ok: boolean }>(`${this.api.baseUrl}${this.base}/entradas/${id}`);
  }

  listarSalidas(filtros?: KardexFiltroInventarioDto): Observable<KardexSalidaResponseDto[]> {
    const params = this.construirQueryParams({
      idEspecialidad: filtros?.idEspecialidad,
      idProyecto: filtros?.idProyecto,
      fechaDesde: filtros?.fechaDesde,
      fechaHasta: filtros?.fechaHasta,
    });

    return this.api.http.get<KardexSalidaResponseDto[]>(`${this.api.baseUrl}${this.base}/salidas`, {
      params,
    });
  }

  crearSalida(dto: KardexSalidaCreateDto): Observable<KardexSalidaResponseDto[]> {
    return this.api.http.post<KardexSalidaResponseDto[]>(
      `${this.api.baseUrl}${this.base}/salidas`,
      dto,
    );
  }

  actualizarSalida(id: number, dto: KardexSalidaCreateDto): Observable<KardexSalidaResponseDto[]> {
    return this.api.http.put<KardexSalidaResponseDto[]>(
      `${this.api.baseUrl}${this.base}/salidas/${id}`,
      dto,
    );
  }

  eliminarSalida(id: number): Observable<{ ok: boolean }> {
    return this.api.http.delete<{ ok: boolean }>(`${this.api.baseUrl}${this.base}/salidas/${id}`);
  }

  listarStockActual(filtros?: KardexStockFiltroDto): Observable<KardexStockActualResponseDto[]> {
    const params = this.construirQueryParams({
      idEspecialidad: filtros?.idEspecialidad,
      fechaDesde: filtros?.fechaDesde,
      fechaHasta: filtros?.fechaHasta,
    });

    return this.api.http.get<KardexStockActualResponseDto[]>(
      `${this.api.baseUrl}${this.base}/stock-actual`,
      { params },
    );
  }

  exportarStockExcel(
    filtros?: KardexStockFiltroDto,
    incluirTotales?: boolean | null,
  ): Observable<HttpResponse<Blob>> {
    const params = this.construirQueryParams({
      idEspecialidad: filtros?.idEspecialidad,
      fechaDesde: filtros?.fechaDesde,
      fechaHasta: filtros?.fechaHasta,
      incluirTotales: incluirTotales,
    });

    return this.api.http.get(`${this.api.baseUrl}${this.base}/stock-actual/exportar-excel`, {
      responseType: 'blob',
      observe: 'response',
      params,
    });
  }

  listarStockProyecto(filtros?: FiltrosStockProyecto): Observable<StockProyecto[]> {
    const params = this.construirQueryParams({
      idProyecto: filtros?.idProyecto,
      idEspecialidad: filtros?.idEspecialidad,
      idMaterial: filtros?.idMaterial,
      fechaDesde: filtros?.fechaDesde,
      fechaHasta: filtros?.fechaHasta,
    });

    return this.api.http.get<StockProyecto[]>(`${this.api.baseUrl}${this.base}/stock-proyecto`, {
      params,
    });
  }

  private construirQueryParams(
    valores: Record<string, string | number | boolean | null | undefined>,
  ): HttpParams {
    let params = new HttpParams();

    for (const [clave, valor] of Object.entries(valores)) {
      if (valor === undefined || valor === null || valor === '') continue;

      params = params.set(clave, valor);
    }

    return params;
  }
}
