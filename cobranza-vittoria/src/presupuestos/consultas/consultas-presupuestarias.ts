import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ReporteFiltro,
  GastoPorCentroCosto,
  GastoPorPartida,
  PresupuestoVsComprometido,
  PresupuestoVsEjecutado,
  SaldoPartida,
  ResumenPresupuestario,
} from './contratos-consultas-presupuestarias';
import { DatosArbolPresupuestario } from '../arbol/contratos-arbol-presupuestario';
import { Tablero } from '../tablero/contratos-tablero-presupuestario';
import { ApiHttp } from '../../core/http/api-http';
import { parametrosConsulta } from '../parametros-presupuestarios';

@Injectable({ providedIn: 'root' })
export class ConsultasPresupuestarias {
  private readonly api = inject(ApiHttp);
  private readonly base = `${this.api.baseUrl}/api/control-presupuestario`;

  resumen(filtro: ReporteFiltro = {}): Observable<ResumenPresupuestario> {
    return this.api.http.get<ResumenPresupuestario>(`${this.base}/consultas/resumen`, {
      params: parametrosConsulta({ ...filtro }),
    });
  }

  saldos(filtro: ReporteFiltro = {}): Observable<SaldoPartida[]> {
    return this.api.http.get<SaldoPartida[]>(`${this.base}/consultas/saldo`, {
      params: parametrosConsulta({ ...filtro }),
    });
  }

  vigente(filtro: ReporteFiltro = {}): Observable<SaldoPartida[]> {
    return this.api.http.get<SaldoPartida[]>(`${this.base}/consultas/vigente`, {
      params: parametrosConsulta({ ...filtro }),
    });
  }

  presupuestoVsComprometido(filtro: ReporteFiltro = {}): Observable<PresupuestoVsComprometido[]> {
    return this.api.http.get<PresupuestoVsComprometido[]>(
      `${this.base}/consultas/presupuesto-vs-comprometido`,
      { params: parametrosConsulta({ ...filtro }) },
    );
  }

  presupuestoVsEjecutado(filtro: ReporteFiltro = {}): Observable<PresupuestoVsEjecutado[]> {
    return this.api.http.get<PresupuestoVsEjecutado[]>(
      `${this.base}/consultas/presupuesto-vs-ejecutado`,
      { params: parametrosConsulta({ ...filtro }) },
    );
  }

  dashboard(
    idCentroCosto: number,
    idPresupuesto?: number | null,
    nivel?: number | null,
    idPartidaPadre?: number | null,
    partidasExcluidas: readonly number[] = [],
  ): Observable<Tablero> {
    let params = parametrosConsulta({ idCentroCosto, idPresupuesto, nivel, idPartidaPadre });
    for (const id of partidasExcluidas) {
      params = params.append('partidasExcluidas', id);
    }

    return this.api.http.get<Tablero>(`${this.base}/consultas/dashboard`, {
      params,
    });
  }

  arbolVigente(
    idCentroCosto: number,
    idPresupuesto?: number | null,
  ): Observable<DatosArbolPresupuestario> {
    return this.api.http.get<DatosArbolPresupuestario>(`${this.base}/consultas/arbol`, {
      params: parametrosConsulta({ ...{ idCentroCosto, idPresupuesto } }),
    });
  }

  arbolVersion(idPresupuesto: number, idVersion: number): Observable<DatosArbolPresupuestario> {
    return this.api.http.get<DatosArbolPresupuestario>(
      `${this.rutaVersion(idPresupuesto, idVersion)}/arbol`,
    );
  }

  gastosPorPartida(filtro: ReporteFiltro = {}): Observable<GastoPorPartida[]> {
    return this.api.http.get<GastoPorPartida[]>(`${this.base}/consultas/gastos-por-partida`, {
      params: parametrosConsulta({ ...filtro }),
    });
  }

  gastosPorCentroCosto(filtro: ReporteFiltro = {}): Observable<GastoPorCentroCosto[]> {
    return this.api.http.get<GastoPorCentroCosto[]>(
      `${this.base}/consultas/gastos-por-centro-costo`,
      { params: parametrosConsulta({ ...filtro }) },
    );
  }
  private rutaVersion(idPresupuesto: number, idVersion: number): string {
    return `${this.base}/presupuestos/${idPresupuesto}/versiones/${idVersion}`;
  }
}
