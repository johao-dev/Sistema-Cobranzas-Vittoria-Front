import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  KardexEntradaCreateDto,
  KardexEntradaResponseDto,
  KardexFiltroInventarioDto,
  KardexSalidaCreateDto,
  KardexSalidaResponseDto,
  KardexStockActualResponseDto,
  KardexStockFiltroDto
} from '../../models/kardex-inventario.models';

@Injectable({ providedIn: 'root' })
export class KardexInventarioService {
  private readonly base = '/api/almacen/kardex';

  constructor(private api: ApiService) {}

  listarEntradas(filtros?: KardexFiltroInventarioDto): Observable<KardexEntradaResponseDto[]> {
    const qs = this.construirQueryParams({
      idEspecialidad: filtros?.idEspecialidad,
      idProveedor: filtros?.idProveedor,
      idProyecto: filtros?.idProyecto,
      fechaDesde: filtros?.fechaDesde,
      fechaHasta: filtros?.fechaHasta
    });
    return this.api.http.get<KardexEntradaResponseDto[]>(`${this.api.baseUrl}${this.base}/entradas${qs}`);
  }

  crearEntrada(dto: KardexEntradaCreateDto): Observable<KardexEntradaResponseDto> {
    return this.api.http.post<KardexEntradaResponseDto>(`${this.api.baseUrl}${this.base}/entradas`, dto);
  }

  actualizarEntrada(id: number, dto: KardexEntradaCreateDto): Observable<KardexEntradaResponseDto> {
    return this.api.http.put<KardexEntradaResponseDto>(`${this.api.baseUrl}${this.base}/entradas/${id}`, dto);
  }

  eliminarEntrada(id: number): Observable<void> {
    return this.api.http.delete<void>(`${this.api.baseUrl}${this.base}/entradas/${id}`);
  }

  listarSalidas(filtros?: KardexFiltroInventarioDto): Observable<KardexSalidaResponseDto[]> {
    const qs = this.construirQueryParams({
      idEspecialidad: filtros?.idEspecialidad,
      idProyecto: filtros?.idProyecto,
      fechaDesde: filtros?.fechaDesde,
      fechaHasta: filtros?.fechaHasta
    });
    return this.api.http.get<KardexSalidaResponseDto[]>(`${this.api.baseUrl}${this.base}/salidas${qs}`);
  }

  crearSalida(dto: KardexSalidaCreateDto): Observable<KardexSalidaResponseDto[]> {
    return this.api.http.post<KardexSalidaResponseDto[]>(`${this.api.baseUrl}${this.base}/salidas`, dto);
  }

  actualizarSalida(id: number, dto: KardexSalidaCreateDto): Observable<KardexSalidaResponseDto[]> {
    return this.api.http.put<KardexSalidaResponseDto[]>(`${this.api.baseUrl}${this.base}/salidas/${id}`, dto);
  }

  eliminarSalida(id: number): Observable<void> {
    return this.api.http.delete<void>(`${this.api.baseUrl}${this.base}/salidas/${id}`);
  }

  listarStockActual(filtros?: KardexStockFiltroDto): Observable<KardexStockActualResponseDto[]> {
    const qs = this.construirQueryParams({
      idEspecialidad: filtros?.idEspecialidad,
      idProyecto: filtros?.idProyecto,
      fechaDesde: filtros?.fechaDesde,
      fechaHasta: filtros?.fechaHasta
    });
    return this.api.http.get<KardexStockActualResponseDto[]>(`${this.api.baseUrl}${this.base}/stock-actual${qs}`);
  }

  private construirQueryParams(valores: Record<string, string | number | null | undefined>): string {
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(valores)) {
      if (valor === undefined || valor === null || valor === '') continue;
      params.append(clave, String(valor));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }
}
