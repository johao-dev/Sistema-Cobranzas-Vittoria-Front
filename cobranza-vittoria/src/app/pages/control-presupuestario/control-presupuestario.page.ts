import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlPresupuestarioService, NodoArbol, ReporteFiltro } from '../../core/services/control-presupuestario.service';
import { NotificationService } from '../../core/services/notification.service';
import { TableroPresupuestarioComponent } from './tablero/tablero-presupuestario.component';
import { ArbolPresupuestarioComponent } from './arbol/arbol-presupuestario.component';

type Vista = 'saldos' | 'comprometido' | 'ejecutado' | 'gastos-partida' | 'gastos-centro';

@Component({
  standalone: true,
  selector: 'app-control-presupuestario-page',
  imports: [CommonModule, FormsModule, TableroPresupuestarioComponent, ArbolPresupuestarioComponent],
  templateUrl: './control-presupuestario.page.html',
  styleUrl: './control-presupuestario.page.css'
})
export class ControlPresupuestarioPage implements OnInit {
  centrosCosto: any[] = [];
  presupuestos: any[] = [];

  totales: any = null;
  porCentroCosto: any[] = [];
  partidasExcedidas: any[] = [];
  filas: any[] = [];

  movimientos: any[] = [];
  detalleSeleccionado: any = null;
  modalMovimientos = false;
  cargandoMovimientos = false;

  vista: Vista = 'saldos';
  cargando = false;
  cargandoResumen = false;

  filtroCentroCosto = '';
  filtroPresupuesto = '';
  soloExcedidos = false;
  filtroBusqueda = '';
  /** Nivel de anidamiento del dashboard; '' = partidas finales. */
  filtroNivel = '';
  /** Nivel más profundo del centro de costo / presupuesto elegido, informado por el dashboard. */
  nivelMaximoTablero = 0;

  constructor(
    private cp: ControlPresupuestarioService,
    private notifications: NotificationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.cargarCatalogos();
    this.recargar();
  }

  // ------------------------------------------------------------------- filtros

  /** El dashboard se arma por centro de costo (y opcionalmente por presupuesto). */
  get idCentroCostoDashboard(): number | null {
    return this.filtroCentroCosto === '' ? null : Number(this.filtroCentroCosto);
  }

  get idPresupuestoDashboard(): number | null {
    return this.filtroPresupuesto === '' ? null : Number(this.filtroPresupuesto);
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
      idCentroCosto: this.filtroCentroCosto === '' ? null : Number(this.filtroCentroCosto),
      idPresupuesto: this.filtroPresupuesto === '' ? null : Number(this.filtroPresupuesto),
      soloExcedidos: this.soloExcedidos ? true : null
    };
  }

  get presupuestosDisponibles(): any[] {
    if (this.filtroCentroCosto === '') return this.presupuestos;
    return this.presupuestos.filter(p => String(p.idCentroCosto) === String(this.filtroCentroCosto));
  }

  private normalizar(valor: any): string {
    return (valor ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  get filasFiltradas(): any[] {
    const termino = this.normalizar(this.filtroBusqueda);
    if (!termino) return this.filas ?? [];
    return (this.filas ?? []).filter(f =>
      this.normalizar([f.codigoPartida, f.partida, f.codigoCentroCosto, f.centroCosto,
      f.codigoPresupuesto, f.presupuesto].join(' ')).includes(termino));
  }

  /** La vista por centro de costo agrega y no expone columnas de partida. */
  get muestraPartida(): boolean {
    return this.vista !== 'gastos-centro';
  }

  get muestraComprometido(): boolean {
    return this.vista === 'saldos' || this.vista === 'comprometido' || this.vista === 'gastos-centro';
  }

  get muestraEjecutado(): boolean {
    return this.vista !== 'comprometido';
  }

  get muestraSaldo(): boolean {
    return this.vista === 'saldos' || this.vista === 'gastos-centro';
  }

  get etiquetaVista(): string {
    switch (this.vista) {
      case 'saldos': return 'Saldo disponible por partida';
      case 'comprometido': return 'Presupuesto vs. comprometido';
      case 'ejecutado': return 'Presupuesto vs. ejecutado';
      case 'gastos-partida': return 'Gastos por partida';
      case 'gastos-centro': return 'Gastos por centro de costo';
      default: return '';
    }
  }

  // -------------------------------------------------------------------- carga

  cargarCatalogos(): void {
    this.cp.centrosCosto(true, null, null).subscribe({
      next: rows => {
        this.centrosCosto = rows ?? [];
        this.cdr.detectChanges();
      },
      error: () => this.notifications.show('No se pudieron cargar los centros de costo.', 'error')
    });

    this.cp.presupuestos(true, null, null, null).subscribe({
      next: rows => {
        this.presupuestos = rows ?? [];
        this.cdr.detectChanges();
      },
      error: () => this.notifications.show('No se pudieron cargar los presupuestos.', 'error')
    });
  }

  onCentroCostoChange(): void {
    // El presupuesto elegido puede no pertenecer al nuevo centro de costo.
    const sigueValido = this.presupuestosDisponibles
      .some(p => String(p.idPresupuesto) === String(this.filtroPresupuesto));
    if (!sigueValido) this.filtroPresupuesto = '';
    this.recargar();
  }

  recargar(): void {
    this.cargarResumen();
    this.cargarVista();
  }

  cargarResumen(): void {
    this.cargandoResumen = true;
    this.cp.resumen(this.filtro).subscribe({
      next: data => {
        this.totales = data?.totales ?? null;
        this.porCentroCosto = data?.porCentroCosto ?? [];
        this.partidasExcedidas = data?.partidasExcedidas ?? [];
        this.cargandoResumen = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.cargandoResumen = false;
        this.notifications.show(err?.error?.message || 'No se pudo cargar el resumen.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  cambiarVista(vista: Vista): void {
    this.vista = vista;
    this.cargarVista();
  }

  cargarVista(): void {
    this.cargando = true;
    const filtro = this.filtro;

    const peticion =
      this.vista === 'saldos' ? this.cp.saldos(filtro)
        : this.vista === 'comprometido' ? this.cp.presupuestoVsComprometido(filtro)
          : this.vista === 'ejecutado' ? this.cp.presupuestoVsEjecutado(filtro)
            : this.vista === 'gastos-partida' ? this.cp.gastosPorPartida(filtro)
              : this.cp.gastosPorCentroCosto(filtro);

    peticion.subscribe({
      next: rows => {
        this.filas = rows ?? [];
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.cargando = false;
        this.filas = [];
        this.notifications.show(err?.error?.message || 'No se pudo cargar el reporte.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  // -------------------------------------------------------------- movimientos

  verMovimientos(fila: any): void {
    if (!fila?.idPresupuestoDetalle) {
      this.notifications.show('Esta vista no permite abrir el historial de una partida.', 'info');
      return;
    }
    this.detalleSeleccionado = fila;
    this.modalMovimientos = true;
    this.cargandoMovimientos = true;
    this.movimientos = [];

    this.cp.movimientos(fila.idPresupuesto, fila.idPresupuestoVersion, fila.idPresupuestoDetalle).subscribe({
      next: rows => {
        this.movimientos = rows ?? [];
        this.cargandoMovimientos = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.cargandoMovimientos = false;
        this.notifications.show(err?.error?.message || 'No se pudo cargar el historial.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  /** Hoja del árbol: solo tiene detalle propio si pertenece a un único presupuesto. */
  verMovimientosNodo(nodo: NodoArbol): void {
    if (!nodo.idPresupuestoDetalle || !nodo.idPresupuesto || !nodo.idPresupuestoVersion) {
      this.notifications.show(
        'Esta partida suma montos de varios presupuestos. Elige un presupuesto en el filtro para ver sus movimientos.',
        'info');
      return;
    }
    this.verMovimientos({
      idPresupuesto: nodo.idPresupuesto,
      idPresupuestoVersion: nodo.idPresupuestoVersion,
      idPresupuestoDetalle: nodo.idPresupuestoDetalle,
      codigoPartida: nodo.codigo,
      partida: nodo.nombre
    });
  }

  cerrarModal(): void {
    this.modalMovimientos = false;
    this.cdr.detectChanges();
  }

  porcentaje(fila: any): number {
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

    const columnas = Object.keys(filas[0]);
    const escapar = (valor: any) => {
      const texto = valor === null || valor === undefined ? '' : String(valor);
      return `"${texto.replace(/"/g, '""')}"`;
    };
    const contenido = [
      columnas.join(';'),
      ...filas.map(f => columnas.map(c => escapar(f[c])).join(';'))
    ].join('\r\n');

    const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `control-presupuestario-${this.vista}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  }
}
