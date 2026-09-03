
import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

/** @deprecated Servicio legacy ligado al flujo de Compras. Para el nuevo módulo de Kardex manual usar `KardexInventarioService`. */
@Injectable({ providedIn: 'root' })
export class KardexService {
  constructor(private api: ApiService) { }

  /** @deprecated Endpoint legacy `/api/almacen/kardex/movimientos` (flujo Compras). Sin reemplazo directo en el nuevo módulo. */
  movimientos(filters?: any) {
    const params = new URLSearchParams();

    if (filters?.idCompra !== undefined && filters?.idCompra !== null) {
      params.append('idCompra', String(filters.idCompra));
    }

    if (filters?.idMaterial !== undefined && filters?.idMaterial !== null) {
      params.append('idMaterial', String(filters.idMaterial));
    }

    if (filters?.idEspecialidad !== undefined && filters?.idEspecialidad !== null) {
      params.append('idEspecialidad', String(filters.idEspecialidad));
    }

    if (filters?.fechaDesde) {
      params.append('fechaDesde', String(filters.fechaDesde));
    }

    if (filters?.fechaHasta) {
      params.append('fechaHasta', String(filters.fechaHasta));
    }

    const qs = params.toString();

    return this.api.http.get<any[]>(
      `${this.api.baseUrl}/api/almacen/kardex/movimientos${qs ? '?' + qs : ''}`
    );
  }

  /** @deprecated Endpoint legacy POST `/api/almacen/kardex/salidas` con DTO antiguo (CantidadSalida, IdCompra, IdMaterial). Migrado a `KardexInventarioService.crearSalida` con el nuevo DTO `KardexSalidaCreateDto`. */
  registrarSalida(dto: any) {
    return this.api.http.post<any>(`${this.api.baseUrl}/api/almacen/kardex/salidas`, dto);
  }

  /** @deprecated Migrado a `KardexInventarioService.listarEntradas` con tipado fuerte. */
  entradas(filters?: { idEspecialidad?: number | null; idProveedor?: number | null; idProyecto?: number | null; fechaDesde?: string | null; fechaHasta?: string | null }) {
    const params = new URLSearchParams();

    if (filters?.idEspecialidad !== undefined && filters?.idEspecialidad !== null) {
      params.append('idEspecialidad', String(filters.idEspecialidad));
    }
    if (filters?.idProveedor !== undefined && filters?.idProveedor !== null) {
      params.append('idProveedor', String(filters.idProveedor));
    }
    if (filters?.idProyecto !== undefined && filters?.idProyecto !== null) {
      params.append('idProyecto', String(filters.idProyecto));
    }
    if (filters?.fechaDesde) {
      params.append('fechaDesde', String(filters.fechaDesde));
    }
    if (filters?.fechaHasta) {
      params.append('fechaHasta', String(filters.fechaHasta));
    }

    const qs = params.toString();
    return this.api.http.get<any[]>(
      `${this.api.baseUrl}/api/almacen/kardex/entradas${qs ? '?' + qs : ''}`
    );
  }

  /** @deprecated Migrado a `KardexInventarioService.guardarEntrada` (`crearEntrada` / `actualizarEntrada`). */
  guardarEntrada(dto: any) {
    return dto.idKardexEntrada
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/almacen/kardex/entradas/${dto.idKardexEntrada}`, dto)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/almacen/kardex/entradas`, dto);
  }

  /** @deprecated Migrado a `KardexInventarioService.eliminarEntrada`. */
  eliminarEntrada(id: number) {
    return this.api.http.delete<any>(`${this.api.baseUrl}/api/almacen/kardex/entradas/${id}`);
  }

  /** @deprecated Migrado a `KardexInventarioService.listarSalidas` con tipado fuerte. */
  salidas(filters?: { idEspecialidad?: number | null; idProyecto?: number | null; fechaDesde?: string | null; fechaHasta?: string | null }) {
    const params = new URLSearchParams();

    if (filters?.idEspecialidad !== undefined && filters?.idEspecialidad !== null) {
      params.append('idEspecialidad', String(filters.idEspecialidad));
    }
    if (filters?.idProyecto !== undefined && filters?.idProyecto !== null) {
      params.append('idProyecto', String(filters.idProyecto));
    }
    if (filters?.fechaDesde) {
      params.append('fechaDesde', String(filters.fechaDesde));
    }
    if (filters?.fechaHasta) {
      params.append('fechaHasta', String(filters.fechaHasta));
    }

    const qs = params.toString();
    return this.api.http.get<any[]>(
      `${this.api.baseUrl}/api/almacen/kardex/salidas${qs ? '?' + qs : ''}`
    );
  }

  /** @deprecated Migrado a `KardexInventarioService.guardarSalida` (`crearSalida` / `actualizarSalida`). */
  guardarSalida(dto: any) {
    return dto.idKardexSalida
      ? this.api.http.put<any>(`${this.api.baseUrl}/api/almacen/kardex/salidas/${dto.idKardexSalida}`, dto)
      : this.api.http.post<any>(`${this.api.baseUrl}/api/almacen/kardex/salidas`, dto);
  }

  /** @deprecated Migrado a `KardexInventarioService.eliminarSalida`. */
  eliminarSalida(id: number) {
    return this.api.http.delete<any>(`${this.api.baseUrl}/api/almacen/kardex/salidas/${id}`);
  }

  /** @deprecated Migrado a `KardexInventarioService.listarStockActual` con tipado fuerte. */
  stockActual(filters?: { idEspecialidad?: number | null; idProyecto?: number | null; fechaDesde?: string | null; fechaHasta?: string | null }) {
    const params = new URLSearchParams();

    if (filters?.idEspecialidad !== undefined && filters?.idEspecialidad !== null) {
      params.append('idEspecialidad', String(filters.idEspecialidad));
    }
    if (filters?.idProyecto !== undefined && filters?.idProyecto !== null) {
      params.append('idProyecto', String(filters.idProyecto));
    }
    if (filters?.fechaDesde) {
      params.append('fechaDesde', String(filters.fechaDesde));
    }
    if (filters?.fechaHasta) {
      params.append('fechaHasta', String(filters.fechaHasta));
    }

    const qs = params.toString();
    return this.api.http.get<any[]>(
      `${this.api.baseUrl}/api/almacen/kardex/stock-actual${qs ? '?' + qs : ''}`
    );
  }
}
