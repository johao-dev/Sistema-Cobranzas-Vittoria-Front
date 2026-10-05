import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { GastosDirectosService } from '../../core/services/gastos-directos.service';
import { ControlPresupuestarioService } from '../../core/services/control-presupuestario.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { descargarArchivo } from '../../core/utils/file-download.util';

/** Configuración de cada pantalla de Operaciones → Gastos del proyecto (viene en data de la ruta). */
export interface SeccionGastoConfig {
  seccion: 'ADMINISTRATIVO' | 'TERRENO' | 'MARKETING_VENTAS' | 'OTROS' | 'MUNICIPAL';
  titulo: string;
  subtitulo: string;
}

/**
 * Gasto directo de una sección de Gastos del proyecto. Las cinco secciones usan
 * este mismo componente: cada una lista solo sus gastos y ofrece solo sus
 * centros de costo y partidas. Todas escriben en la misma tabla de gastos
 * directos, así el Panel de control ve todo junto.
 *
 * REGISTRADO no afecta el saldo; CONFIRMADO lo ejecuta y ANULADO lo devuelve.
 */
@Component({
  standalone: true,
  selector: 'app-gastos-seccion-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './gastos-seccion.page.html',
  styleUrl: './gastos-seccion.page.css'
})
export class GastosSeccionPage implements OnInit {
  config!: SeccionGastoConfig;

  rows: any[] = [];
  centrosCosto: any[] = [];
  proveedores: any[] = [];
  monedas: any[] = [];
  /** Partidas de la sección con su saldo vigente en el centro de costo elegido. */
  partidas: any[] = [];
  /** Partidas de la sección en el catálogo: una tarjeta de total por cada una (como las pantallas antiguas). */
  partidasSeccion: any[] = [];

  documentos: any[] = [];
  gastoSeleccionado: any = null;

  loading = false;
  guardando = false;
  cargandoPartidas = false;
  cargandoDocumentos = false;
  subiendo = false;

  filtroEstado = '';
  filtroCentroCosto = '';
  filtroDesde = '';
  filtroHasta = '';
  filtroBusqueda = '';

  modalGasto = false;
  modalDocumentos = false;
  modalConfirmacion: { accion: 'confirmar' | 'anular'; row: any } | null = null;

  form: any = this.formVacio();
  tipoDocumento: 'Factura' | 'Pago' = 'Factura';
  archivos: File[] = [];

  constructor(
    private route: ActivatedRoute,
    private gastos: GastosDirectosService,
    private cp: ControlPresupuestarioService,
    private notifications: NotificationService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // El componente se reutiliza entre rutas: se recarga al cambiar de sección.
    this.route.data.subscribe(data => {
      this.config = data as SeccionGastoConfig;
      this.filtroEstado = '';
      this.filtroCentroCosto = '';
      this.filtroBusqueda = '';
      this.rows = [];
      this.cerrarModales();
      this.cargarCatalogos();
      this.load();
    });
  }

  /** Registrar, editar, confirmar, anular y adjuntar exige gasto_directo.operar. */
  get puedeOperar(): boolean {
    return this.auth.hasPermission('gasto_directo.operar');
  }

  formVacio() {
    return {
      idGastoDirecto: null,
      idCentroCosto: '',
      idPresupuestoDetalle: '',
      idProveedor: '',
      idMoneda: '',
      fecha: new Date().toISOString().substring(0, 10),
      concepto: '',
      descripcion: '',
      monto: null as number | null,
      facturaOtraMoneda: false,
      idMonedaOriginal: '',
      montoOriginal: null as number | null,
      tipoCambio: null as number | null,
      fechaTipoCambio: ''
    };
  }

  get proveedoresDeLaSeccion(): any[] {
    return this.proveedores.filter(p => p.deLaSeccion);
  }

  get otrosProveedores(): any[] {
    return this.proveedores.filter(p => !p.deLaSeccion);
  }

  /** Gastos vigentes del listado filtrado (los anulados no suman). */
  private get vigentes(): any[] {
    return this.rowsFiltradas.filter(r => r.estado !== 'ANULADO');
  }

  get registrosVigentes(): number {
    return this.vigentes.length;
  }

  /** Total por categoría (partida) y moneda, para las tarjetas de resumen. */
  totalesDePartida(idCatalogoPartida: number): { moneda: string; total: number }[] {
    return this.totalizar(this.vigentes.filter(r => Number(r.idCatalogoPartida) === Number(idCatalogoPartida)));
  }

  private totalizar(filas: any[]): { moneda: string; total: number }[] {
    const totales = new Map<string, number>();
    for (const r of filas) totales.set(r.moneda, (totales.get(r.moneda) ?? 0) + Number(r.monto ?? 0));
    return Array.from(totales, ([moneda, total]) => ({ moneda, total }));
  }

  /**
   * Columnas Soles / Dólares como en las pantallas antiguas: el monto del gasto
   * va en la columna de su moneda y, si la factura vino en la otra, su monto
   * original (referencia) en la otra columna.
   */
  montoEn(row: any, moneda: 'PEN' | 'USD'): { valor: number; referencia: boolean } | null {
    if (row.moneda === moneda) return { valor: Number(row.monto), referencia: false };
    if (row.monedaOriginal === moneda) return { valor: Number(row.montoOriginal), referencia: true };
    return null;
  }

  totalColumna(moneda: 'PEN' | 'USD'): number {
    return this.vigentes.filter(r => r.moneda === moneda).reduce((acc, r) => acc + Number(r.monto ?? 0), 0);
  }

  get hayMoneda(): { pen: boolean; usd: boolean } {
    return { pen: this.vigentes.some(r => r.moneda === 'PEN'), usd: this.vigentes.some(r => r.moneda === 'USD') };
  }

  get esEdicion(): boolean {
    return !!this.form.idGastoDirecto;
  }

  get partidaSeleccionada(): any | null {
    if (!this.form.idPresupuestoDetalle) return null;
    return (this.partidas || [])
      .find(p => Number(p.idPresupuestoDetalle) === Number(this.form.idPresupuestoDetalle)) ?? null;
  }

  /** El gasto se registra en la moneda del presupuesto de la partida: no hay conversión. */
  get monedaPresupuesto(): any | null {
    const partida = this.partidaSeleccionada;
    if (!partida) return null;
    return this.monedas.find(m => Number(m.idMoneda) === Number(partida.idMoneda))
      ?? { idMoneda: partida.idMoneda, codigo: partida.codigoMoneda, simbolo: partida.simboloMoneda };
  }

  /** Monedas posibles para la factura original: cualquiera salvo la del presupuesto. */
  get monedasOriginales(): any[] {
    const actual = Number(this.form.idMoneda || 0);
    return this.monedas.filter(m => Number(m.idMoneda) !== actual);
  }

  get excedeSaldo(): boolean {
    const partida = this.partidaSeleccionada;
    if (!partida) return false;
    return Number(this.form.monto ?? 0) > Number(partida.saldoDisponible ?? 0);
  }

  /** Monto original × tipo de cambio, como ayuda para completar el monto en la moneda del presupuesto. */
  get montoSugerido(): number | null {
    if (!this.form.facturaOtraMoneda) return null;
    const original = Number(this.form.montoOriginal || 0);
    const tc = Number(this.form.tipoCambio || 0);
    return original > 0 && tc > 0 ? Math.round(original * tc * 100) / 100 : null;
  }

  private normalizar(valor: any): string {
    return (valor ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  get rowsFiltradas(): any[] {
    const termino = this.normalizar(this.filtroBusqueda);
    if (!termino) return this.rows ?? [];
    return (this.rows ?? []).filter(r =>
      this.normalizar([r.concepto, r.proveedor, r.codigoPartida, r.partida, r.centroCosto,
        r.codigoPresupuesto].join(' ')).includes(termino));
  }

  /**
   * Totales del listado por moneda, sin anulados: sumar soles con dólares o
   * contar gastos anulados daría una cifra sin sentido.
   */
  get totalesPorMoneda(): { moneda: string; total: number }[] {
    return this.totalizar(this.vigentes);
  }

  // -------------------------------------------------------------------- carga

  cargarCatalogos(): void {
    this.gastos.centrosCosto(this.config.seccion).subscribe({
      next: rows => { this.centrosCosto = rows ?? []; this.cdr.detectChanges(); },
      error: () => this.notifications.show('No se pudieron cargar los centros de costo.', 'error')
    });

    this.cp.catalogos().subscribe({
      next: data => {
        this.monedas = data?.monedas ?? [];
        const seccion = (data?.seccionesGasto ?? []).find((s: any) => s.codigo === this.config.seccion);
        if (seccion) this.cargarPartidasSeccion(seccion.idSeccionGasto);
        this.cdr.detectChanges();
      },
      error: () => this.notifications.show('No se pudieron cargar las monedas.', 'error')
    });

    this.gastos.proveedores(this.config.seccion).subscribe({
      next: rows => { this.proveedores = rows ?? []; this.cdr.detectChanges(); },
      error: () => this.notifications.show('No se pudieron cargar los proveedores.', 'error')
    });
  }

  private cargarPartidasSeccion(idSeccionGasto: number): void {
    this.cp.partidas({ activo: true, esHoja: true, idSeccionGasto }).subscribe({
      next: rows => { this.partidasSeccion = rows ?? []; this.cdr.detectChanges(); },
      error: () => { this.partidasSeccion = []; }
    });
  }

  load(): void {
    this.loading = true;
    this.gastos.listar({
      seccion: this.config.seccion,
      estado: this.filtroEstado || null,
      idCentroCosto: this.filtroCentroCosto === '' ? null : Number(this.filtroCentroCosto),
      desde: this.filtroDesde || null,
      hasta: this.filtroHasta || null
    }).subscribe({
      next: rows => {
        this.rows = rows ?? [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.loading = false;
        this.notifications.show(err?.error?.message || 'No se pudieron cargar los gastos.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  onCentroCostoFormChange(): void {
    this.form.idPresupuestoDetalle = '';
    this.form.idMoneda = '';
    this.cargarPartidas();
  }

  cargarPartidas(): void {
    if (!this.form.idCentroCosto) {
      this.partidas = [];
      this.cdr.detectChanges();
      return;
    }

    this.cargandoPartidas = true;
    this.gastos.partidasDisponibles(this.config.seccion, Number(this.form.idCentroCosto)).subscribe({
      next: rows => {
        this.partidas = rows ?? [];
        this.cargandoPartidas = false;
        this.onPartidaChange();
      },
      error: () => {
        this.partidas = [];
        this.cargandoPartidas = false;
        this.cdr.detectChanges();
      }
    });
  }

  /** La moneda del gasto es la del presupuesto de la partida elegida. */
  onPartidaChange(): void {
    const partida = this.partidaSeleccionada;
    this.form.idMoneda = partida?.idMoneda ?? '';
    if (this.form.idMonedaOriginal && Number(this.form.idMonedaOriginal) === Number(this.form.idMoneda)) {
      this.form.idMonedaOriginal = '';
    }
    this.cdr.detectChanges();
  }

  /** Al marcar "factura en otra moneda", la fecha del tipo de cambio arranca en la del gasto. */
  onFacturaOtraMonedaChange(): void {
    if (this.form.facturaOtraMoneda && !this.form.fechaTipoCambio) this.form.fechaTipoCambio = this.form.fecha;
  }

  usarMontoSugerido(): void {
    if (this.montoSugerido !== null) this.form.monto = this.montoSugerido;
  }

  // ------------------------------------------------------------------ edición

  abrirModalNuevo(): void {
    this.form = this.formVacio();
    this.partidas = [];
    this.modalGasto = true;
    this.cdr.detectChanges();
  }

  editar(row: any): void {
    if (row.estado !== 'REGISTRADO') {
      this.notifications.show('Solo se puede editar un gasto en estado REGISTRADO.', 'info');
      return;
    }
    this.form = {
      idGastoDirecto: row.idGastoDirecto,
      idCentroCosto: row.idCentroCosto,
      idPresupuestoDetalle: row.idPresupuestoDetalle,
      idProveedor: row.idProveedor ?? '',
      idMoneda: row.idMoneda,
      fecha: (row.fecha ?? '').toString().substring(0, 10),
      concepto: row.concepto ?? '',
      descripcion: row.descripcion ?? '',
      monto: row.monto ?? null,
      facturaOtraMoneda: !!row.idMonedaOriginal,
      idMonedaOriginal: row.idMonedaOriginal ?? '',
      montoOriginal: row.montoOriginal ?? null,
      tipoCambio: row.tipoCambio ?? null,
      fechaTipoCambio: (row.fechaTipoCambio ?? '').toString().substring(0, 10)
    };
    this.modalGasto = true;
    this.cargarPartidas();
  }

  guardar(): void {
    if (!this.form.idCentroCosto) {
      this.notifications.show('Selecciona el centro de costo.', 'info');
      return;
    }
    if (!this.form.idPresupuestoDetalle) {
      this.notifications.show('Selecciona la partida a la que se carga el gasto.', 'info');
      return;
    }
    if (!String(this.form.concepto ?? '').trim()) {
      this.notifications.show('Ingresa el concepto del gasto.', 'info');
      return;
    }
    const monto = Number(this.form.monto ?? 0);
    if (isNaN(monto) || monto <= 0) {
      this.notifications.show('El monto debe ser mayor a cero.', 'info');
      return;
    }
    if (this.form.facturaOtraMoneda
      && (!this.form.idMonedaOriginal || !(Number(this.form.montoOriginal) > 0) || !(Number(this.form.tipoCambio) > 0))) {
      this.notifications.show('Completa la moneda, el monto original y el tipo de cambio de la factura.', 'info');
      return;
    }

    this.guardando = true;
    const dto = { ...this.form, seccion: this.config.seccion };
    const peticion = this.esEdicion
      ? this.gastos.actualizar(this.form.idGastoDirecto, dto)
      : this.gastos.crear(dto);

    peticion.subscribe({
      next: () => {
        this.guardando = false;
        this.modalGasto = false;
        this.notifications.show('Gasto guardado. No afecta el saldo hasta que se confirme.', 'success');
        this.load();
      },
      error: err => {
        this.guardando = false;
        this.notifications.show(err?.error?.message || 'No se pudo guardar el gasto.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  // ------------------------------------------------------- confirmar / anular

  /**
   * Gasto histórico migrado: vive en un presupuesto HIST-… inactivo. Se puede anular,
   * pero confirmarlo daría 409 RECURSO_INACTIVO, así que no se ofrece.
   */
  esHistorico(row: any): boolean {
    return String(row?.codigoPresupuesto ?? '').toUpperCase().startsWith('HIST-');
  }

  pedirConfirmacion(accion: 'confirmar' | 'anular', row: any): void {
    this.modalConfirmacion = { accion, row };
    this.cdr.detectChanges();
  }

  ejecutarConfirmacion(): void {
    if (!this.modalConfirmacion) return;
    const { accion, row } = this.modalConfirmacion;
    const estabaConfirmado = row.estado === 'CONFIRMADO';
    this.guardando = true;
    const peticion = accion === 'confirmar'
      ? this.gastos.confirmar(row.idGastoDirecto)
      : this.gastos.anular(row.idGastoDirecto);
    peticion.subscribe({
      next: () => {
        this.guardando = false;
        this.modalConfirmacion = null;
        this.notifications.show(accion === 'confirmar'
          ? 'Gasto confirmado: el monto quedó ejecutado.'
          : estabaConfirmado ? 'Gasto anulado: se devolvió el monto con un ajuste.' : 'Gasto anulado.', 'success');
        this.load();
      },
      error: err => {
        this.guardando = false;
        this.modalConfirmacion = null;
        this.notifications.show(err?.error?.message
          || (accion === 'confirmar' ? 'No se pudo confirmar el gasto.' : 'No se pudo anular el gasto.'), 'error');
        this.cdr.detectChanges();
      }
    });
  }

  onAccion(event: Event, row: any): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    select.value = '';
    if (value === 'edit') this.editar(row);
    if (value === 'confirmar') this.pedirConfirmacion('confirmar', row);
    if (value === 'anular') this.pedirConfirmacion('anular', row);
    if (value === 'documentos') this.verDocumentos(row);
  }

  // --------------------------------------------------------------- documentos

  verDocumentos(row: any): void {
    this.gastoSeleccionado = row;
    this.modalDocumentos = true;
    this.cargandoDocumentos = true;
    this.documentos = [];
    this.archivos = [];

    this.gastos.documentos(row.idGastoDirecto).subscribe({
      next: rows => {
        this.documentos = rows ?? [];
        this.cargandoDocumentos = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.cargandoDocumentos = false;
        this.notifications.show(err?.error?.message || 'No se pudieron cargar los documentos.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  onArchivosSeleccionados(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.archivos = Array.from(input.files ?? []);
    this.cdr.detectChanges();
  }

  subirDocumentos(): void {
    if (!this.gastoSeleccionado) return;
    if (!this.archivos.length) {
      this.notifications.show('Selecciona al menos un PDF.', 'info');
      return;
    }
    if (this.archivos.some(f => !f.name.toLowerCase().endsWith('.pdf'))) {
      this.notifications.show('Solo se permiten archivos PDF.', 'error');
      return;
    }

    this.subiendo = true;
    this.gastos.subirDocumentos(this.gastoSeleccionado.idGastoDirecto, this.tipoDocumento, this.archivos).subscribe({
      next: () => {
        this.subiendo = false;
        this.notifications.show('Documentos adjuntados.', 'success');
        this.verDocumentos(this.gastoSeleccionado);
        this.load();
      },
      error: err => {
        this.subiendo = false;
        this.notifications.show(err?.error?.message || 'No se pudieron adjuntar los documentos.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  descargar(documento: any): void {
    this.gastos.descargarDocumento(this.gastoSeleccionado.idGastoDirecto, documento.idGastoDirectoDocumento)
      .subscribe({
        next: blob => descargarArchivo(blob, documento.nombreArchivo || 'documento.pdf'),
        error: () => this.notifications.show('No se pudo descargar el documento.', 'error')
      });
  }

  cerrarModales(): void {
    if (this.guardando) return;
    this.modalGasto = false;
    this.modalDocumentos = false;
    this.modalConfirmacion = null;
    this.cdr.detectChanges();
  }
}
