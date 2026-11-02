import {
  MontoPartida,
  BorradorPresupuesto,
  BorradorVersion,
  BorradorDetalle,
  BorradorAjuste,
} from './borradores-presupuesto';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpResponse } from '@angular/common/http';
import {
  Presupuesto,
  VersionPresupuesto,
  DetallePresupuesto,
  PresupuestoCreado,
  VersionCreada,
  ResultadoCargaPresupuesto,
  ResultadoEstructuraPresupuesto,
  MovimientoPresupuestario,
} from './contratos-presupuestos';
import { ApiService } from '../app/core/services/api.service';
import { parametrosConsulta, textoOpcional } from './parametros-presupuestarios';

@Injectable({ providedIn: 'root' })
export class RegistroPresupuestos {
  private readonly api = inject(ApiService);
  private readonly base = `${this.api.baseUrl}/api/control-presupuestario`;

  presupuestos(
    activo?: boolean | null,
    idCentroCosto?: number | null,
    idMoneda?: number | null,
    busqueda?: string | null,
  ) {
    return this.api.http.get<Presupuesto[]>(`${this.base}/presupuestos`, {
      params: parametrosConsulta({ ...{ activo, idCentroCosto, idMoneda, busqueda } }),
    });
  }

  presupuesto(id: number): Observable<Presupuesto> {
    return this.api.http.get<Presupuesto>(`${this.base}/presupuestos/${id}`);
  }

  crearPresupuesto(dto: BorradorPresupuesto): Observable<PresupuestoCreado> {
    return this.api.http.post<PresupuestoCreado>(`${this.base}/presupuestos`, {
      idCentroCosto: Number(dto.idCentroCosto),
      idMoneda: Number(dto.idMoneda),
      codigo: (dto.codigo ?? '').toString().trim(),
      nombre: (dto.nombre ?? '').toString().trim(),
      descripcion: textoOpcional(dto.descripcion),
      fechaInicio: textoOpcional(dto.fechaInicio),
      fechaFin: textoOpcional(dto.fechaFin),
    });
  }

  actualizarPresupuesto(
    id: number,
    dto: BorradorPresupuesto,
    confirmarInactivacion = false,
  ): Observable<Presupuesto> {
    return this.api.http.put<Presupuesto>(`${this.base}/presupuestos/${id}`, {
      nombre: (dto.nombre ?? '').toString().trim(),
      activo: !!dto.activo,
      descripcion: textoOpcional(dto.descripcion),
      fechaInicio: textoOpcional(dto.fechaInicio),
      fechaFin: textoOpcional(dto.fechaFin),
      confirmarInactivacion,
    });
  }

  versiones(idPresupuesto: number): Observable<VersionPresupuesto[]> {
    return this.api.http.get<VersionPresupuesto[]>(
      `${this.base}/presupuestos/${idPresupuesto}/versiones`,
    );
  }

  version(idPresupuesto: number, idVersion: number): Observable<VersionPresupuesto> {
    return this.api.http.get<VersionPresupuesto>(this.rutaVersion(idPresupuesto, idVersion));
  }

  crearVersion(
    idPresupuesto: number,
    dto: Partial<BorradorVersion> = {},
  ): Observable<VersionCreada> {
    return this.api.http.post<VersionCreada>(
      `${this.base}/presupuestos/${idPresupuesto}/versiones`,
      {
        descripcion: textoOpcional(dto.descripcion),
        motivoCambio: textoOpcional(dto.motivoCambio),
      },
    );
  }

  aprobarVersion(idPresupuesto: number, idVersion: number): Observable<VersionPresupuesto> {
    return this.api.http.post<VersionPresupuesto>(
      `${this.rutaVersion(idPresupuesto, idVersion)}/aprobar`,
      {},
    );
  }

  anularVersion(
    idPresupuesto: number,
    idVersion: number,
    motivo: string,
  ): Observable<VersionPresupuesto> {
    return this.api.http.post<VersionPresupuesto>(
      `${this.rutaVersion(idPresupuesto, idVersion)}/anular`,
      {
        motivo: (motivo ?? '').toString().trim(),
      },
    );
  }

  detalles(idPresupuesto: number, idVersion: number): Observable<DetallePresupuesto[]> {
    return this.api.http.get<DetallePresupuesto[]>(
      `${this.rutaVersion(idPresupuesto, idVersion)}/partidas`,
    );
  }

  agregarDetalle(
    idPresupuesto: number,
    idVersion: number,
    dto: BorradorDetalle,
  ): Observable<DetallePresupuesto> {
    return this.api.http.post<DetallePresupuesto>(
      `${this.rutaVersion(idPresupuesto, idVersion)}/partidas`,
      {
        idCatalogoPartida: Number(dto.idCatalogoPartida),
        montoPresupuestado: Number(dto.montoPresupuestado ?? 0),
        observacion: textoOpcional(dto.observacion),
      },
    );
  }

  cargarDetallesLote(
    idPresupuesto: number,
    idVersion: number,
    detalles: MontoPartida[],
    quitarAusentes = false,
  ): Observable<ResultadoCargaPresupuesto> {
    return this.api.http.put<ResultadoCargaPresupuesto>(
      `${this.rutaVersion(idPresupuesto, idVersion)}/partidas/lote`,
      {
        detalles: detalles.map((d) => ({
          idCatalogoPartida: d.idCatalogoPartida,
          montoPresupuestado: d.montoPresupuestado,
          observacion: textoOpcional(d.observacion),
        })),
        quitarAusentes,
      },
    );
  }

  importarPresupuesto(
    idPresupuesto: number,
    idVersion: number,
    archivo: File,
    quitarAusentes: boolean,
  ): Observable<ResultadoCargaPresupuesto> {
    const form = new FormData();
    form.append('archivo', archivo);
    form.append('quitarAusentes', String(quitarAusentes));
    return this.api.http.post<ResultadoCargaPresupuesto>(
      `${this.rutaVersion(idPresupuesto, idVersion)}/partidas/importar`,
      form,
    );
  }

  plantillaPresupuesto(
    idPresupuesto: number,
    idVersion: number,
    formato: 'csv' | 'xlsx',
  ): Observable<HttpResponse<Blob>> {
    return this.api.http.get(`${this.rutaVersion(idPresupuesto, idVersion)}/partidas/plantilla`, {
      params: parametrosConsulta({ formato }),
      responseType: 'blob',
      observe: 'response',
    });
  }

  importarEstructura(
    idPresupuesto: number,
    idVersion: number,
    archivo: File,
    quitarAusentes: boolean,
  ): Observable<ResultadoEstructuraPresupuesto> {
    const form = new FormData();
    form.append('archivo', archivo);
    form.append('quitarAusentes', String(quitarAusentes));
    return this.api.http.post<ResultadoEstructuraPresupuesto>(
      `${this.rutaVersion(idPresupuesto, idVersion)}/partidas/importar-estructura`,
      form,
    );
  }

  plantillaEstructura(
    idPresupuesto: number,
    idVersion: number,
    formato: 'csv' | 'xlsx',
  ): Observable<HttpResponse<Blob>> {
    return this.api.http.get(
      `${this.rutaVersion(idPresupuesto, idVersion)}/partidas/plantilla-estructura`,
      { params: parametrosConsulta({ formato }), responseType: 'blob', observe: 'response' },
    );
  }

  actualizarDetalle(
    idPresupuesto: number,
    idVersion: number,
    idDetalle: number,
    dto: BorradorDetalle,
  ): Observable<DetallePresupuesto> {
    return this.api.http.put<DetallePresupuesto>(
      `${this.rutaVersion(idPresupuesto, idVersion)}/partidas/${idDetalle}`,
      {
        montoPresupuestado: Number(dto.montoPresupuestado ?? 0),
        observacion: textoOpcional(dto.observacion),
      },
    );
  }

  eliminarDetalle(idPresupuesto: number, idVersion: number, idDetalle: number): Observable<void> {
    return this.api.http.delete<void>(
      `${this.rutaVersion(idPresupuesto, idVersion)}/partidas/${idDetalle}`,
    );
  }

  movimientos(
    idPresupuesto: number,
    idVersion: number,
    idDetalle: number,
  ): Observable<MovimientoPresupuestario[]> {
    return this.api.http.get<MovimientoPresupuestario[]>(
      `${this.rutaVersion(idPresupuesto, idVersion)}/partidas/${idDetalle}/movimientos`,
    );
  }

  movimiento(idMovimiento: number): Observable<MovimientoPresupuestario> {
    return this.api.http.get<MovimientoPresupuestario>(`${this.base}/movimientos/${idMovimiento}`);
  }

  registrarAjuste(
    idPresupuesto: number,
    idVersion: number,
    idDetalle: number,
    dto: BorradorAjuste,
  ): Observable<MovimientoPresupuestario> {
    return this.api.http.post<MovimientoPresupuestario>(
      `${this.rutaVersion(idPresupuesto, idVersion)}/partidas/${idDetalle}/ajustes`,
      {
        afectacion: (dto.afectacion ?? '').toString().trim().toUpperCase(),
        direccion: (dto.direccion ?? '').toString().trim().toUpperCase(),
        monto: Number(dto.monto ?? 0),
        observacion: (dto.observacion ?? '').toString().trim(),
        fecha: textoOpcional(dto.fecha),
      },
    );
  }
  private rutaVersion(idPresupuesto: number, idVersion: number): string {
    return `${this.base}/presupuestos/${idPresupuesto}/versiones/${idVersion}`;
  }
}
