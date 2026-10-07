import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  CategoriaGasto,
  CentroCostoGastoDirecto,
  GastoDirectoListado,
  GastoDirectoRequest,
  GastosDirectosService,
  PartidaDisponibleGastoDirecto,
  ProveedorGastoDirecto
} from '../../core/services/gastos-directos.service';
import { ControlPresupuestarioService } from '../../core/services/control-presupuestario.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { descargarArchivo } from '../../core/utils/file-download.util';

/** Configuración visual de una ruta; sus códigos resuelven categorías descriptivas, no reglas económicas. */
export interface GastoDirectoVistaConfig {
  titulo: string;
  subtitulo: string;
  codigosCategoria: string[];
  permiteSeleccionCategoria: boolean;
}

interface GastoDirectoForm {
  idGastoDirecto: number | null;
  idCategoriaGasto: number | '';
  idCentroCosto: number | '';
  idPresupuestoDetalle: number | '';
  idProveedor: number | '';
  idMoneda: number | '';
  fecha: string;
  concepto: string;
  descripcion: string;
  monto: number | null;
  facturaOtraMoneda: boolean;
  idMonedaOriginal: number | '';
  montoOriginal: number | null;
  tipoCambio: number | null;
  fechaTipoCambio: string;
}

export function resolverCategoriasPorCodigo(catalogo: CategoriaGasto[], codigos: string[]) {
  const porCodigo = new Map(catalogo.map(categoria => [categoria.codigo.trim().toUpperCase(), categoria]));
  const normalizados = codigos.map(codigo => codigo.trim().toUpperCase());
  return {
    categorias: normalizados.map(codigo => porCodigo.get(codigo)).filter((item): item is CategoriaGasto => !!item),
    faltantes: normalizados.filter(codigo => !porCodigo.has(codigo))
  };
}

/** CRUD compartido de las cinco vistas de Gastos del proyecto. */
@Component({
  standalone: true,
  selector: 'app-gastos-seccion-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './gastos-seccion.page.html',
  styleUrl: './gastos-seccion.page.css'
})
export class GastosSeccionPage implements OnInit {
  config!: GastoDirectoVistaConfig;

  rows: GastoDirectoListado[] = [];
  centrosCosto: CentroCostoGastoDirecto[] = [];
  proveedores: ProveedorGastoDirecto[] = [];
  monedas: any[] = [];
  partidas: PartidaDisponibleGastoDirecto[] = [];
  categoriasVista: CategoriaGasto[] = [];
  errorCategorias = '';

  documentos: any[] = [];
  gastoSeleccionado: GastoDirectoListado | null = null;

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
  modalConfirmacion: { accion: 'confirmar' | 'anular'; row: GastoDirectoListado } | null = null;

  form: GastoDirectoForm = this.formVacio();
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
    // El componente se reutiliza entre rutas y resuelve sus categorías desde el catálogo de la API.
    this.route.data.subscribe(data => {
      this.config = data as GastoDirectoVistaConfig;
      this.filtroEstado = '';
      this.filtroCentroCosto = '';
      this.filtroBusqueda = '';
      this.rows = [];
      this.categoriasVista = [];
      this.errorCategorias = '';
      this.cerrarModales();
      this.cargarCatalogos();
    });
  }

  /** Registrar, editar, confirmar, anular y adjuntar exige gasto_directo.operar. */
  get puedeOperar(): boolean {
    return this.auth.hasPermission('gasto_directo.operar');
  }

  formVacio(): GastoDirectoForm {
    return {
      idGastoDirecto: null,
      idCategoriaGasto: this.categoriasVista?.length === 1 ? this.categoriasVista[0].idCategoriaGasto : '',
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

  get categoriasResueltas(): boolean {
    return !this.errorCategorias
      && this.categoriasVista.length === this.config?.codigosCategoria?.length
      && this.categoriasVista.length > 0;
  }

  /** Gastos vigentes del listado filtrado (los anulados no suman). */
  private get vigentes(): GastoDirectoListado[] {
    return this.rowsFiltradas.filter(r => r.estado !== 'ANULADO');
  }

  get registrosVigentes(): number {
    return this.vigentes.length;
  }

  private totalizar(filas: GastoDirectoListado[]): { moneda: string; total: number }[] {
    const totales = new Map<string, number>();
    for (const r of filas) {
      const moneda = r.moneda ?? '';
      totales.set(moneda, (totales.get(moneda) ?? 0) + Number(r.monto ?? 0));
    }
    return Array.from(totales, ([moneda, total]) => ({ moneda, total }));
  }

  /**
   * Columnas Soles / Dólares como en las pantallas antiguas: el monto del gasto
   * va en la columna de su moneda y, si la factura vino en la otra, su monto
   * original (referencia) en la otra columna.
   */
  montoEn(row: GastoDirectoListado, moneda: 'PEN' | 'USD'): { valor: number; referencia: boolean } | null {
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

  get partidaSeleccionada(): PartidaDisponibleGastoDirecto | null {
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

  private normalizar(valor: unknown): string {
    return (valor ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  get rowsFiltradas(): GastoDirectoListado[] {
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
    this.gastos.categorias().subscribe({
      next: catalogo => {
        const resultado = resolverCategoriasPorCodigo(catalogo ?? [], this.config.codigosCategoria ?? []);
        this.categoriasVista = resultado.categorias;
        if (resultado.faltantes.length) {
          this.errorCategorias = `No se encontraron categorías activas para: ${resultado.faltantes.join(', ')}.`;
          this.notifications.show(this.errorCategorias, 'error');
          this.rows = [];
          this.loading = false;
        } else {
          this.errorCategorias = '';
          this.form = this.formVacio();
          this.load();
        }
        this.cdr.detectChanges();
      },
      error: err => {
        this.errorCategorias = err?.error?.message || 'No se pudo cargar el catálogo de categorías de gasto.';
        this.notifications.show(this.errorCategorias, 'error');
        this.rows = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });

    this.gastos.centrosCosto().subscribe({
      next: rows => { this.centrosCosto = rows ?? []; this.cdr.detectChanges(); },
      error: () => this.notifications.show('No se pudieron cargar los centros de costo.', 'error')
    });

    this.cp.catalogos().subscribe({
      next: data => {
        this.monedas = data?.monedas ?? [];
        this.cdr.detectChanges();
      },
      error: () => this.notifications.show('No se pudieron cargar las monedas.', 'error')
    });

    this.gastos.proveedores().subscribe({
      next: rows => { this.proveedores = rows ?? []; this.cdr.detectChanges(); },
      error: () => this.notifications.show('No se pudieron cargar los proveedores.', 'error')
    });
  }

  load(): void {
    if (!this.categoriasResueltas) return;
    this.loading = true;
    this.gastos.listar({
      idCategoriaGasto: this.categoriasVista.map(categoria => categoria.idCategoriaGasto),
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
    this.gastos.partidasDisponibles(Number(this.form.idCentroCosto)).subscribe({
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
    if (!this.categoriasResueltas) {
      this.notifications.show(this.errorCategorias || 'No están disponibles las categorías de esta vista.', 'error');
      return;
    }
    this.form = this.formVacio();
    this.partidas = [];
    this.modalGasto = true;
    this.cdr.detectChanges();
  }

  editar(row: GastoDirectoListado): void {
    if (row.estado !== 'REGISTRADO') {
      this.notifications.show('Solo se puede editar un gasto en estado REGISTRADO.', 'info');
      return;
    }
    const categoriaPermitida = row.idCategoriaGasto != null
      && this.categoriasVista.some(categoria => categoria.idCategoriaGasto === row.idCategoriaGasto);
    if (!categoriaPermitida) {
      this.notifications.show('La categoría del gasto no pertenece a esta vista y no puede editarse aquí.', 'error');
      return;
    }
    this.form = {
      idGastoDirecto: row.idGastoDirecto,
      idCategoriaGasto: row.idCategoriaGasto as number,
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
    if (this.categoriasVista.length === 1) {
      this.form.idCategoriaGasto = this.categoriasVista[0].idCategoriaGasto;
    }
    const idCategoriaGasto = Number(this.form.idCategoriaGasto || 0);
    if (!idCategoriaGasto
      || !this.categoriasVista.some(categoria => categoria.idCategoriaGasto === idCategoriaGasto)) {
      this.notifications.show('Selecciona una categoría válida para esta vista.', 'info');
      return;
    }
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
    const dto: GastoDirectoRequest = {
      idPresupuestoDetalle: Number(this.form.idPresupuestoDetalle),
      idCategoriaGasto,
      idProveedor: this.form.idProveedor === '' ? null : Number(this.form.idProveedor),
      idMoneda: Number(this.form.idMoneda),
      fecha: this.form.fecha,
      concepto: this.form.concepto,
      descripcion: this.form.descripcion.trim() || null,
      monto,
      idMonedaOriginal: this.form.facturaOtraMoneda && this.form.idMonedaOriginal !== ''
        ? Number(this.form.idMonedaOriginal) : null,
      montoOriginal: this.form.facturaOtraMoneda ? Number(this.form.montoOriginal) : null,
      tipoCambio: this.form.facturaOtraMoneda ? Number(this.form.tipoCambio) : null,
      fechaTipoCambio: this.form.facturaOtraMoneda ? (this.form.fechaTipoCambio || null) : null
    };
    const peticion = this.esEdicion
      ? this.gastos.actualizar(Number(this.form.idGastoDirecto), dto)
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
  esHistorico(row: GastoDirectoListado): boolean {
    return String(row?.codigoPresupuesto ?? '').toUpperCase().startsWith('HIST-');
  }

  pedirConfirmacion(accion: 'confirmar' | 'anular', row: GastoDirectoListado): void {
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

  onAccion(event: Event, row: GastoDirectoListado): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    select.value = '';
    if (value === 'edit') this.editar(row);
    if (value === 'confirmar') this.pedirConfirmacion('confirmar', row);
    if (value === 'anular') this.pedirConfirmacion('anular', row);
    if (value === 'documentos') this.verDocumentos(row);
  }

  // --------------------------------------------------------------- documentos

  verDocumentos(row: GastoDirectoListado): void {
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

    const gasto = this.gastoSeleccionado;
    this.subiendo = true;
    this.gastos.subirDocumentos(gasto.idGastoDirecto, this.tipoDocumento, this.archivos).subscribe({
      next: () => {
        this.subiendo = false;
        this.notifications.show('Documentos adjuntados.', 'success');
        this.verDocumentos(gasto);
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
    if (!this.gastoSeleccionado) return;
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
