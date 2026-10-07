import { Injectable } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService } from './api.service';

/** Filtros compartidos por las consultas presupuestarias. */
export interface ReporteFiltro {
  idCentroCosto?: number | null;
  idPresupuesto?: number | null;
  idPresupuestoVersion?: number | null;
  idCatalogoPartida?: number | null;
  idMoneda?: number | null;
  estadoPresupuesto?: string | null;
  soloExcedidos?: boolean | null;
}

/**
 * Nodo del árbol de partidas. En un padre los montos son la suma de sus hojas.
 * Las hojas traen los ids del detalle para abrir sus movimientos (null si suman varios presupuestos).
 */
export interface NodoArbol {
  idCatalogoPartida: number;
  codigo: string;
  nombre: string;
  idPartidaPadre: number | null;
  nivel: number;
  esHoja: boolean;
  cantidadHijas: number;
  cantidadHojas: number;
  montoPresupuestado: number;
  montoComprometido: number;
  montoEjecutado: number;
  saldoDisponible: number;
  porcentajeComprometido: number;
  porcentajeEjecutado: number;
  excedido: boolean;
  partidasExcedidas: number;
  idPresupuesto?: number | null;
  idPresupuestoVersion?: number | null;
  idPresupuestoDetalle?: number | null;
}

/** Respuesta de /consultas/arbol y /versiones/{id}/arbol; nodos es una lista plana en preorden. */
export interface ArbolPresupuestario {
  encabezado: {
    idCentroCosto: number;
    codigoCentroCosto: string;
    nombreCentroCosto: string;
    idPresupuesto: number | null;
    idPresupuestoVersion: number | null;
    estadoPresupuesto: string | null;
    codigoMoneda: string;
    simboloMoneda: string;
  };
  totales: {
    montoPresupuestado: number;
    montoComprometido: number;
    montoEjecutado: number;
    saldoDisponible: number;
    porcentajeComprometido: number;
    porcentajeEjecutado: number;
    cantidadPartidas: number;
    partidasExcedidas: number;
  };
  nodos: NodoArbol[];
}

/**
 * Cliente del contrato de API de Control Presupuestario. Versiones y partidas de versión son
 * recursos subordinados del presupuesto: sus rutas llevan /presupuestos/{id}/versiones/{versionId}.
 */
@Injectable({ providedIn: 'root' })
export class ControlPresupuestarioService {
  private readonly base: string;

  constructor(private api: ApiService) {
    this.base = `${this.api.baseUrl}/api/control-presupuestario`;
  }

  // ------------------------------------------------------------------ catálogos

  /** Reúne los catálogos auxiliares en un solo objeto para los formularios. */
  catalogos() {
    const c = `${this.base}/catalogos`;
    return forkJoin({
      tiposCentroCosto: this.api.http.get<any[]>(`${c}/tipos-centro-costo`),
      tiposPartida: this.api.http.get<any[]>(`${c}/tipos-partida`),
      estadosPresupuesto: this.api.http.get<any[]>(`${c}/estados-presupuesto`),
      tiposMovimiento: this.api.http.get<any[]>(`${c}/tipos-movimiento`),
      monedas: this.api.http.get<any[]>(`${c}/monedas`)
    });
  }

  // ----------------------------------------------------------- centros de costo

  centrosCosto(activo?: boolean | null, idTipoCentroCosto?: number | null, busqueda?: string | null,
    idProyecto?: number | null) {
    const qs = this.query({ activo, idTipoCentroCosto, idProyecto, busqueda });
    return this.api.http.get<any[]>(`${this.base}/centros-costo${qs}`);
  }

  centroCosto(id: number) {
    return this.api.http.get<any>(`${this.base}/centros-costo/${id}`);
  }

  guardarCentroCosto(dto: any) {
    const idProyecto = dto.idProyecto != null && dto.idProyecto !== '' ? Number(dto.idProyecto) : null;
    return dto.idCentroCosto
      ? this.api.http.put<any>(`${this.base}/centros-costo/${dto.idCentroCosto}`, {
        nombre: (dto.nombre ?? '').toString().trim(),
        activo: !!dto.activo,
        descripcion: this.texto(dto.descripcion),
        idProyecto
      })
      : this.api.http.post<any>(`${this.base}/centros-costo`, {
        codigo: (dto.codigo ?? '').toString().trim(),
        nombre: (dto.nombre ?? '').toString().trim(),
        idTipoCentroCosto: Number(dto.idTipoCentroCosto),
        descripcion: this.texto(dto.descripcion),
        idProyecto
      });
  }

  // -------------------------------------------------------------------- partidas

  partidas(filtros: {
    activo?: boolean | null;
    idTipoPartida?: number | null;
    idPartidaPadre?: number | null;
    soloRaices?: boolean | null;
    esHoja?: boolean | null;
    busqueda?: string | null;
  } = {}) {
    return this.api.http.get<any[]>(`${this.base}/partidas${this.query(filtros)}`);
  }

  partida(id: number) {
    return this.api.http.get<any>(`${this.base}/partidas/${id}`);
  }

  guardarPartida(dto: any) {
    const padre = dto.idPartidaPadre != null && dto.idPartidaPadre !== '' ? Number(dto.idPartidaPadre) : null;
    return dto.idCatalogoPartida
      ? this.api.http.put<any>(`${this.base}/partidas/${dto.idCatalogoPartida}`, {
        nombre: (dto.nombre ?? '').toString().trim(),
        idTipoPartida: Number(dto.idTipoPartida),
        activo: !!dto.activo,
        idPartidaPadre: padre,
        descripcion: this.texto(dto.descripcion)
      })
      : this.api.http.post<any>(`${this.base}/partidas`, {
        codigo: (dto.codigo ?? '').toString().trim(),
        nombre: (dto.nombre ?? '').toString().trim(),
        idTipoPartida: Number(dto.idTipoPartida),
        idPartidaPadre: padre,
        descripcion: this.texto(dto.descripcion)
      });
  }

  // ---------------------------------------------------------------- presupuestos

  presupuestos(activo?: boolean | null, idCentroCosto?: number | null,
    idMoneda?: number | null, busqueda?: string | null) {
    return this.api.http.get<any[]>(
      `${this.base}/presupuestos${this.query({ activo, idCentroCosto, idMoneda, busqueda })}`);
  }

  presupuesto(id: number) {
    return this.api.http.get<any>(`${this.base}/presupuestos/${id}`);
  }

  /** Crea el presupuesto y su versión 1 en borrador; responde { idPresupuesto, idPresupuestoVersion, numeroVersion, estado }. */
  crearPresupuesto(dto: any) {
    return this.api.http.post<any>(`${this.base}/presupuestos`, {
      idCentroCosto: Number(dto.idCentroCosto),
      idMoneda: Number(dto.idMoneda),
      codigo: (dto.codigo ?? '').toString().trim(),
      nombre: (dto.nombre ?? '').toString().trim(),
      descripcion: this.texto(dto.descripcion),
      fechaInicio: this.fecha(dto.fechaInicio),
      fechaFin: this.fecha(dto.fechaFin)
    });
  }

  /**
   * Inactivar un presupuesto con registros asociados responde 409 PRESUPUESTO_CON_REGISTROS;
   * se reenvía con confirmarInactivacion = true cuando el usuario lo confirma.
   */
  actualizarPresupuesto(id: number, dto: any, confirmarInactivacion = false) {
    return this.api.http.put<any>(`${this.base}/presupuestos/${id}`, {
      nombre: (dto.nombre ?? '').toString().trim(),
      activo: !!dto.activo,
      descripcion: this.texto(dto.descripcion),
      fechaInicio: this.fecha(dto.fechaInicio),
      fechaFin: this.fecha(dto.fechaFin),
      confirmarInactivacion
    });
  }

  // -------------------------------------------------------------------- versiones

  versiones(idPresupuesto: number) {
    return this.api.http.get<any[]>(`${this.base}/presupuestos/${idPresupuesto}/versiones`);
  }

  version(idPresupuesto: number, idVersion: number) {
    return this.api.http.get<any>(this.rutaVersion(idPresupuesto, idVersion));
  }

  crearVersion(idPresupuesto: number, dto: any = {}) {
    return this.api.http.post<any>(`${this.base}/presupuestos/${idPresupuesto}/versiones`, {
      descripcion: this.texto(dto.descripcion),
      motivoCambio: this.texto(dto.motivoCambio)
    });
  }

  aprobarVersion(idPresupuesto: number, idVersion: number) {
    return this.api.http.post<any>(`${this.rutaVersion(idPresupuesto, idVersion)}/aprobar`, {});
  }

  /** Solo un borrador se anula, y exige el motivo. */
  anularVersion(idPresupuesto: number, idVersion: number, motivo: string) {
    return this.api.http.post<any>(`${this.rutaVersion(idPresupuesto, idVersion)}/anular`, {
      motivo: (motivo ?? '').toString().trim()
    });
  }

  // --------------------------------------------------------- partidas de la versión

  detalles(idPresupuesto: number, idVersion: number) {
    return this.api.http.get<any[]>(`${this.rutaVersion(idPresupuesto, idVersion)}/partidas`);
  }

  agregarDetalle(idPresupuesto: number, idVersion: number, dto: any) {
    return this.api.http.post<any>(`${this.rutaVersion(idPresupuesto, idVersion)}/partidas`, {
      idCatalogoPartida: Number(dto.idCatalogoPartida),
      montoPresupuestado: Number(dto.montoPresupuestado ?? 0),
      observacion: this.texto(dto.observacion)
    });
  }

  /**
   * Carga completa de montos sobre una versión en borrador (todo o nada).
   * Con quitarAusentes, las partidas que no vienen en el lote se eliminan.
   */
  cargarDetallesLote(idPresupuesto: number, idVersion: number, detalles: {
    idCatalogoPartida: number; montoPresupuestado: number; observacion?: string | null
  }[], quitarAusentes = false) {
    return this.api.http.put<any>(`${this.rutaVersion(idPresupuesto, idVersion)}/partidas/lote`, {
      detalles: detalles.map(d => ({
        idCatalogoPartida: Number(d.idCatalogoPartida),
        montoPresupuestado: Number(d.montoPresupuestado ?? 0),
        observacion: this.texto(d.observacion)
      })),
      quitarAusentes
    });
  }

  /** Importa montos desde CSV/XLSX. En 422 el cuerpo trae errores[] por fila. */
  importarPresupuesto(idPresupuesto: number, idVersion: number, archivo: File, quitarAusentes: boolean) {
    const form = new FormData();
    form.append('archivo', archivo);
    form.append('quitarAusentes', String(quitarAusentes));
    return this.api.http.post<any>(`${this.rutaVersion(idPresupuesto, idVersion)}/partidas/importar`, form);
  }

  /** Plantilla con todas las partidas hoja activas y los montos actuales de la versión. */
  plantillaPresupuesto(idPresupuesto: number, idVersion: number, formato: 'csv' | 'xlsx') {
    return this.api.http.get(`${this.rutaVersion(idPresupuesto, idVersion)}/partidas/plantilla?formato=${formato}`,
      { responseType: 'blob', observe: 'response' });
  }

  /**
   * Importación jerárquica (formato de las áreas): crea en el catálogo las partidas que falten
   * y carga los montos de las hojas en la versión borrador. Todo o nada.
   */
  importarEstructura(idPresupuesto: number, idVersion: number, archivo: File, quitarAusentes: boolean) {
    const form = new FormData();
    form.append('archivo', archivo);
    form.append('quitarAusentes', String(quitarAusentes));
    return this.api.http.post<any>(`${this.rutaVersion(idPresupuesto, idVersion)}/partidas/importar-estructura`, form);
  }

  /** Plantilla con el árbol completo del catálogo activo y los montos actuales de la versión. */
  plantillaEstructura(idPresupuesto: number, idVersion: number, formato: 'csv' | 'xlsx') {
    return this.api.http.get(
      `${this.rutaVersion(idPresupuesto, idVersion)}/partidas/plantilla-estructura?formato=${formato}`,
      { responseType: 'blob', observe: 'response' });
  }

  /** Árbol de partidas con subtotales de una versión en cualquier estado. */
  arbolVersion(idPresupuesto: number, idVersion: number) {
    return this.api.http.get<ArbolPresupuestario>(`${this.rutaVersion(idPresupuesto, idVersion)}/arbol`);
  }

  actualizarDetalle(idPresupuesto: number, idVersion: number, idDetalle: number, dto: any) {
    return this.api.http.put<any>(`${this.rutaVersion(idPresupuesto, idVersion)}/partidas/${idDetalle}`, {
      montoPresupuestado: Number(dto.montoPresupuestado ?? 0),
      observacion: this.texto(dto.observacion)
    });
  }

  eliminarDetalle(idPresupuesto: number, idVersion: number, idDetalle: number) {
    return this.api.http.delete<void>(`${this.rutaVersion(idPresupuesto, idVersion)}/partidas/${idDetalle}`);
  }

  // ------------------------------------------------------------------ movimientos

  movimientos(idPresupuesto: number, idVersion: number, idDetalle: number) {
    return this.api.http.get<any[]>(`${this.rutaVersion(idPresupuesto, idVersion)}/partidas/${idDetalle}/movimientos`);
  }

  movimiento(idMovimiento: number) {
    return this.api.http.get<any>(`${this.base}/movimientos/${idMovimiento}`);
  }

  registrarAjuste(idPresupuesto: number, idVersion: number, idDetalle: number, dto: any) {
    return this.api.http.post<any>(`${this.rutaVersion(idPresupuesto, idVersion)}/partidas/${idDetalle}/ajustes`, {
      afectacion: (dto.afectacion ?? '').toString().trim().toUpperCase(),
      direccion: (dto.direccion ?? '').toString().trim().toUpperCase(),
      monto: Number(dto.monto ?? 0),
      observacion: (dto.observacion ?? '').toString().trim(),
      fecha: this.fecha(dto.fecha)
    });
  }

  // -------------------------------------------------------------------- consultas

  resumen(filtro: ReporteFiltro = {}) {
    return this.api.http.get<any>(`${this.base}/consultas/resumen${this.query(filtro)}`);
  }

  saldos(filtro: ReporteFiltro = {}) {
    return this.api.http.get<any[]>(`${this.base}/consultas/saldo${this.query(filtro)}`);
  }

  vigente(filtro: ReporteFiltro = {}) {
    return this.api.http.get<any[]>(`${this.base}/consultas/vigente${this.query(filtro)}`);
  }

  presupuestoVsComprometido(filtro: ReporteFiltro = {}) {
    return this.api.http.get<any[]>(`${this.base}/consultas/presupuesto-vs-comprometido${this.query(filtro)}`);
  }

  presupuestoVsEjecutado(filtro: ReporteFiltro = {}) {
    return this.api.http.get<any[]>(`${this.base}/consultas/presupuesto-vs-ejecutado${this.query(filtro)}`);
  }

  /**
   * Dashboard de un centro de costo: distribución por rubro y curva acumulada real vs presupuesto.
   * Con nivel, cada partida final se agrupa en su categoría ancestra de ese nivel (1 = raíces).
   * Con idPartidaPadre todo el tablero se limita a esa rama (encabezado.rama trae el camino).
   */
  dashboard(idCentroCosto: number, idPresupuesto?: number | null, nivel?: number | null,
    idPartidaPadre?: number | null) {
    return this.api.http.get<any>(
      `${this.base}/consultas/dashboard${this.query({ idCentroCosto, idPresupuesto, nivel, idPartidaPadre })}`);
  }

  /** Árbol vigente de un centro de costo: presupuestos activos con versión aprobada. */
  arbolVigente(idCentroCosto: number, idPresupuesto?: number | null) {
    return this.api.http.get<ArbolPresupuestario>(
      `${this.base}/consultas/arbol${this.query({ idCentroCosto, idPresupuesto })}`);
  }

  gastosPorPartida(filtro: ReporteFiltro = {}) {
    return this.api.http.get<any[]>(`${this.base}/consultas/gastos-por-partida${this.query(filtro)}`);
  }

  gastosPorCentroCosto(filtro: ReporteFiltro = {}) {
    return this.api.http.get<any[]>(`${this.base}/consultas/gastos-por-centro-costo${this.query(filtro)}`);
  }

  // ------------------------------------------------------------------------ apoyo

  private rutaVersion(idPresupuesto: number, idVersion: number): string {
    return `${this.base}/presupuestos/${idPresupuesto}/versiones/${idVersion}`;
  }

  private query(filtros: Record<string, any>): string {
    const params = new URLSearchParams();
    Object.entries(filtros ?? {}).forEach(([clave, valor]) => {
      if (valor === undefined || valor === null || valor === '') return;
      params.append(clave, String(valor));
    });
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  private texto(valor: any): string | null {
    const limpio = (valor ?? '').toString().trim();
    return limpio ? limpio : null;
  }

  private fecha(valor: any): string | null {
    const limpio = (valor ?? '').toString().trim();
    return limpio ? limpio : null;
  }
}
