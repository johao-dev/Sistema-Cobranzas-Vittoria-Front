import { crearCsvPresupuestario } from './exportacion-presupuestaria';
import { descargarArchivo } from '../../shared/archivos/descarga-archivos';
import { normalizarBusqueda } from '../presentacion-presupuestos';
import { Subscription, Observable } from 'rxjs';
import {
  ContextoMovimientos,
  HistorialPresupuestario,
} from '../movimientos/historial-presupuestario';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { extraerMensajeError } from '../../shared/errores-api/mensajes-error-api';
import { Presupuesto } from '../contratos-presupuestos';
import { CentroCostoResumen } from '../centros-costo/contratos-centros-costo';
import {
  ResumenTotales,
  GastoPorCentroCosto,
  SaldoPartida,
  FilaReportePresupuestario,
  ReporteFiltro,
} from './contratos-consultas-presupuestarias';
import { RegistroPresupuestos } from '../registro-presupuestos';
import { ConsultasPresupuestarias } from './consultas-presupuestarias';
import { CatalogoCentrosCosto } from '../centros-costo/catalogo-centros-costo';
import { DestroyRef, inject, ChangeDetectorRef, Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NodoArbol } from '../arbol/contratos-arbol-presupuestario';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { TableroPresupuestario } from '../tablero/tablero-presupuestario';
import { ArbolPresupuestario } from '../arbol/arbol-presupuestario';
import { CatalogoPartidas } from '../partidas/catalogo-partidas';
import { PartidaCatalogo } from '../partidas/contratos-partidas';
import { SelectorPartidas } from '../partidas/selector-partidas';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';

type Vista = 'saldos' | 'comprometido' | 'ejecutado' | 'gastos-partida' | 'gastos-centro';

@Component({
  standalone: true,
  selector: 'control-presupuestario',
  imports: [
    HistorialPresupuestario,
    CommonModule,
    FormsModule,
    TableroPresupuestario,
    ArbolPresupuestario,
    SelectorPartidas,
  ],
  templateUrl: './control-presupuestario.html',
  styleUrls: ['../dialogos-presupuesto.css', './control-presupuestario.css'],
})
export class ControlPresupuestario implements OnInit {
  private consultaCargarResumen?: Subscription;
  private consultaCargarVista?: Subscription;

  private readonly destroyRef = inject(DestroyRef);
  private readonly catalogoCentrosCosto = inject(CatalogoCentrosCosto);
  private readonly consultasPresupuestarias = inject(ConsultasPresupuestarias);
  private readonly registroPresupuestos = inject(RegistroPresupuestos);
  private readonly catalogoPartidas = inject(CatalogoPartidas);
  private readonly sesion = inject(SesionUsuario);
  private contextoConsultado: string | null = null;
  private catalogoPartidasCargado = false;

  protected readonly partidas = signal<PartidaCatalogo[]>([]);
  protected readonly partidasExcluidas = signal<readonly number[]>([]);
  protected readonly cargandoPartidas = signal(false);
  protected readonly errorPartidas = signal('');
  protected readonly puedeConsultarPartidas = this.sesion.hasPermission(
    'control_presupuestario.partida.ver',
  );

  centrosCosto: CentroCostoResumen[] = [];
  presupuestos: Presupuesto[] = [];

  totales: ResumenTotales | null = null;
  porCentroCosto: GastoPorCentroCosto[] = [];
  partidasExcedidas: SaldoPartida[] = [];
  filas: FilaReportePresupuestario[] = [];

  detalleSeleccionado: FilaReportePresupuestario | null = null;
  modalMovimientos = false;
  contextoMovimientos: ContextoMovimientos | null = null;

  vista: Vista = 'saldos';
  cargando = false;
  cargandoResumen = false;

  filtroCentroCosto = '';
  filtroPresupuesto = '';
  filtroBusqueda = '';
  /** Nivel de anidamiento del dashboard; '' = partidas finales. */
  filtroNivel = '';
  /** Nivel más profundo del centro de costo / presupuesto elegido, informado por el dashboard. */
  nivelMaximoTablero = 0;

  private readonly notifications = inject(Notificaciones);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.consultaCargarVista?.unsubscribe());
    this.destroyRef.onDestroy(() => this.consultaCargarResumen?.unsubscribe());
    this.cargarCatalogos();
    this.recargar();
  }

  // ------------------------------------------------------------------- filtros

  /** El dashboard se arma por centro de costo (y opcionalmente por presupuesto). */
  get idCentroCostoDashboard(): number | null {
    return this.normalizarIdentificador(this.filtroCentroCosto);
  }

  get idPresupuestoDashboard(): number | null {
    return this.normalizarIdentificador(this.filtroPresupuesto);
  }

  private normalizarIdentificador(valor: string): number | null {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  private get contextoFiltros(): string {
    return `${this.idCentroCostoDashboard}:${this.idPresupuestoDashboard}`;
  }

  get nivelDashboard(): number | null {
    return this.filtroNivel === '' ? null : Number(this.filtroNivel);
  }

  get nivelesDisponibles(): number[] {
    return Array.from({ length: this.nivelMaximoTablero }, (_, i) => i + 1);
  }

  /** Al cambiar de centro o presupuesto, un nivel que ya no existe vuelve a "Partidas finales". */
  onNivelMaximo(maximo: number): void {
    this.nivelMaximoTablero = maximo;
    if (this.nivelDashboard !== null && this.nivelDashboard > maximo) this.filtroNivel = '';
    this.cdr.detectChanges();
  }

  get filtro(): ReporteFiltro {
    return {
      idCentroCosto: this.idCentroCostoDashboard,
      idPresupuesto: this.idPresupuestoDashboard,
    };
  }

  get presupuestosDisponibles(): Presupuesto[] {
    if (this.filtroCentroCosto === '') return this.presupuestos;
    return this.presupuestos.filter((p) => p.idCentroCosto === this.idCentroCostoDashboard);
  }

  private readonly normalizar = normalizarBusqueda;

  get filasFiltradas(): FilaReportePresupuestario[] {
    const termino = this.normalizar(this.filtroBusqueda);
    if (!termino) return this.filas ?? [];
    return (this.filas ?? []).filter((f) =>
      this.normalizar(
        [
          f.codigoPartida,
          f.partida,
          f.codigoCentroCosto,
          f.centroCosto,
          f.codigoPresupuesto,
          f.presupuesto,
        ].join(' '),
      ).includes(termino),
    );
  }

  /** La vista por centro de costo agrega y no expone columnas de partida. */
  get muestraPartida(): boolean {
    return this.vista !== 'gastos-centro';
  }

  get muestraComprometido(): boolean {
    return (
      this.vista === 'saldos' || this.vista === 'comprometido' || this.vista === 'gastos-centro'
    );
  }

  get muestraEjecutado(): boolean {
    return this.vista !== 'comprometido';
  }

  get muestraSaldo(): boolean {
    return this.vista === 'saldos' || this.vista === 'gastos-centro';
  }

  get etiquetaVista(): string {
    switch (this.vista) {
      case 'saldos':
        return 'Saldo disponible por partida';
      case 'comprometido':
        return 'Presupuesto vs. comprometido';
      case 'ejecutado':
        return 'Presupuesto vs. ejecutado';
      case 'gastos-partida':
        return 'Gastos por partida';
      case 'gastos-centro':
        return 'Gastos por centro de costo';
      default:
        return '';
    }
  }

  // -------------------------------------------------------------------- carga

  cargarCatalogos(): void {
    this.cargarPartidas();
    this.catalogoCentrosCosto
      .centrosCosto(true, null, null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.centrosCosto = rows ?? [];
          this.cdr.detectChanges();
        },
        error: () =>
          this.notifications.show('No se pudieron cargar los centros de costo.', 'error'),
      });

    this.registroPresupuestos
      .presupuestos(true, null, null, null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.presupuestos = rows ?? [];
          this.cdr.detectChanges();
        },
        error: () => this.notifications.show('No se pudieron cargar los presupuestos.', 'error'),
      });
  }

  onCentroCostoChange(): void {
    if (this.contextoConsultado === this.contextoFiltros) return;
    // El presupuesto elegido puede no pertenecer al nuevo centro de costo.
    const sigueValido = this.presupuestosDisponibles.some(
      (p) => p.idPresupuesto === this.idPresupuestoDashboard,
    );
    if (!sigueValido) this.filtroPresupuesto = '';
    this.recargar();
  }

  recargar(): void {
    if (this.contextoConsultado === this.contextoFiltros) return;
    this.contextoConsultado = this.contextoFiltros;
    this.partidasExcluidas.set([]);
    this.cargarResumen();
    this.cargarVista();
  }

  protected cambiarExclusiones(ids: readonly number[]): void {
    const actuales = this.partidasExcluidas();
    const nuevos = [...new Set(ids)].sort((a, b) => a - b);
    if (actuales.length === nuevos.length && actuales.every((id, i) => id === nuevos[i])) return;
    this.partidasExcluidas.set(nuevos);
  }

  protected cargarPartidas(): void {
    if (!this.puedeConsultarPartidas || this.catalogoPartidasCargado || this.cargandoPartidas())
      return;
    this.cargandoPartidas.set(true);
    this.errorPartidas.set('');
    // Sin filtros: incluye partidas inactivas que pueden tener ejecución histórica.
    this.catalogoPartidas
      .partidas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (partidas) => {
          this.partidas.set(partidas);
          this.catalogoPartidasCargado = true;
          this.cargandoPartidas.set(false);
        },
        error: (err: unknown) => {
          this.errorPartidas.set(extraerMensajeError(err, 'No se pudieron cargar las partidas.'));
          this.cargandoPartidas.set(false);
        },
      });
  }

  cargarResumen(): void {
    this.consultaCargarResumen?.unsubscribe();
    this.cargandoResumen = true;
    this.consultaCargarResumen = this.consultasPresupuestarias
      .resumen(this.filtro)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.totales = data?.totales ?? null;
          this.porCentroCosto = data?.porCentroCosto ?? [];
          this.partidasExcedidas = data?.partidasExcedidas ?? [];
          this.cargandoResumen = false;
          this.cdr.detectChanges();
        },
        error: (err: unknown) => {
          this.cargandoResumen = false;
          this.notifications.show(
            extraerMensajeError(err, 'No se pudo cargar el resumen.'),
            'error',
          );
          this.cdr.detectChanges();
        },
      });
  }

  cambiarVista(vista: Vista): void {
    this.vista = vista;
    this.cargarVista();
  }

  cargarVista(): void {
    this.consultaCargarVista?.unsubscribe();
    this.cargando = true;
    const filtro = this.filtro;

    const peticion: Observable<FilaReportePresupuestario[]> =
      this.vista === 'saldos'
        ? this.consultasPresupuestarias.saldos(filtro)
        : this.vista === 'comprometido'
          ? this.consultasPresupuestarias.presupuestoVsComprometido(filtro)
          : this.vista === 'ejecutado'
            ? this.consultasPresupuestarias.presupuestoVsEjecutado(filtro)
            : this.vista === 'gastos-partida'
              ? this.consultasPresupuestarias.gastosPorPartida(filtro)
              : this.consultasPresupuestarias.gastosPorCentroCosto(filtro);

    this.consultaCargarVista = peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.filas = rows ?? [];
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        this.cargando = false;
        this.filas = [];
        this.notifications.show(extraerMensajeError(err, 'No se pudo cargar el reporte.'), 'error');
        this.cdr.detectChanges();
      },
    });
  }

  // -------------------------------------------------------------- movimientos

  verMovimientos(fila: FilaReportePresupuestario): void {
    if (!fila.idPresupuesto || !fila.idPresupuestoVersion || !fila.idPresupuestoDetalle) {
      this.notifications.show('Esta vista no permite abrir el historial de una partida.', 'info');
      return;
    }
    this.contextoMovimientos = {
      idPresupuesto: fila.idPresupuesto,
      idVersion: fila.idPresupuestoVersion,
      idDetalle: fila.idPresupuestoDetalle,
      codigo: fila.codigoPartida ?? null,
      nombre: fila.partida ?? null,
    };
    this.modalMovimientos = true;
  }

  /** Hoja del árbol: solo tiene detalle propio si pertenece a un único presupuesto. */
  verMovimientosNodo(nodo: NodoArbol): void {
    if (!nodo.idPresupuestoDetalle || !nodo.idPresupuesto || !nodo.idPresupuestoVersion) {
      this.notifications.show(
        'Esta partida suma montos de varios presupuestos. Elige un presupuesto en el filtro para ver sus movimientos.',
        'info',
      );
      return;
    }
    this.verMovimientos({
      idPresupuesto: nodo.idPresupuesto,
      idPresupuestoVersion: nodo.idPresupuestoVersion,
      idPresupuestoDetalle: nodo.idPresupuestoDetalle,
      codigoPartida: nodo.codigo,
      partida: nodo.nombre,
    });
  }

  cerrarModal(): void {
    this.modalMovimientos = false;
    this.cdr.detectChanges();
  }

  porcentaje(fila: FilaReportePresupuestario): number {
    if (this.vista === 'comprometido') return Number(fila.porcentajeComprometido ?? 0);
    return Number(fila.porcentajeEjecutado ?? 0);
  }

  /** Verde hasta 80%, ámbar hasta 100%, rojo por encima. */
  claseBarra(valor: number): string {
    if (valor > 100) return 'barra__fill--danger';
    if (valor > 80) return 'barra__fill--warn';
    return 'barra__fill--ok';
  }

  anchoBarra(valor: number): string {
    const acotado = Math.max(0, Math.min(Number(valor) || 0, 100));
    return `${acotado}%`;
  }

  exportarCsv(): void {
    const filas = this.filasFiltradas;
    if (!filas.length) {
      this.notifications.show('No hay datos para exportar.', 'info');
      return;
    }

    const contenido = crearCsvPresupuestario(filas);
    const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' });
    descargarArchivo(blob, `control-presupuestario-${this.vista}.csv`);
  }
}
