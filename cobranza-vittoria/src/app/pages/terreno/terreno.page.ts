import { Component, ChangeDetectorRef, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaestraService } from '../../core/services/maestra.service';
import { SunatService } from '../../core/services/sunat.service';
import { GastoProyectoService, TipoGastoProyecto } from '../../core/services/gasto-proyecto.service';
import { ProveedoresTerrenoService } from '../../core/services/proveedores-terreno.service';
import { NotificationService } from '../../core/services/notification.service';

type GastoProyectoRow = {
  idGastoProyecto: number;
  fecha: string;
  fechaTipoCambio: string | null;
  idProyecto: number | null;
  proyecto: string;
  idProveedorTerreno: number | null;
  proveedor: string;
  concepto: string;
  moneda: string;
  montoSoles: number;
  montoDolares: number;
  tipoCambio: number;
  descripcion: string;
  estado: string;
  activo: boolean;
  totalFacturas: number;
};

@Component({
  standalone: true,
  selector: 'app-terreno-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './terreno.page.html',
  styleUrl: './terreno.page.css'
})
export class TerrenoPage implements OnInit {
  modalOpen = false;

  abrirModalNuevo(): void {
    this.limpiar();
    this.modalOpen = true;
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.modalOpen = false;
    this.cdr.detectChanges();
  }

  private readonly destroyRef = inject(DestroyRef);
  private readonly tipoModulo: TipoGastoProyecto = 'terreno';
  private syncingFromDolares = false;

  proyectos: any[] = [];
  proveedores: any[] = [];
  rows: GastoProyectoRow[] = [];
  documentos: any[] = [];
  selectedFacturaFiles: File[] = [];
  archivosTargetRow: GastoProyectoRow | null = null;
  loading = false;
  msg = '';
  editandoId: number | null = null;
  tipoCambioActual = 3.41;

  readonly conceptos = ['TERRENO', 'ALCABALA', 'ANTEPROYECTO', 'PROYECTO'];

  filtros = {
    idProyecto: '',
    concepto: '',
    estado: ''
  };

  form = this.createEmptyForm();

  constructor(
    private maestra: MaestraService,
    private sunatService: SunatService,
    private gastoProyectoService: GastoProyectoService,
    private proveedoresService: ProveedoresTerrenoService,
    private notifications: NotificationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.sunatService.tipoCambio$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        const sellPrice = this.toNumber(data?.sell_price);
        if (sellPrice > 0) {
          this.tipoCambioActual = sellPrice;
          this.form.tipoCambio = sellPrice;
          const fechaApi = this.normalizarFechaInput(data?.date);
          if (fechaApi) this.form.fechaTipoCambio = fechaApi;
          if (this.toNumber(this.form.montoDolares) > 0) this.onDolaresInput();
        }
        this.cdr.detectChanges();
      });
    this.sunatService.consultarTipoCambio();
    this.loadCatalogos();
    this.load();
  }

  createEmptyForm() {
    return {
      idGastoProyecto: null as number | null,
      fecha: this.todayIso(),
      fechaTipoCambio: this.todayIso(),
      idProyecto: null as number | null,
      idProveedorTerreno: null as number | null,
      concepto: '',
      moneda: 'PEN',
      montoSoles: null as number | null,
      montoDolares: null as number | null,
      tipoCambio: this.tipoCambioActual,
      descripcion: '',
      estado: 'Activo'
    };
  }

  loadCatalogos(): void {
    this.maestra.proyectos(true).subscribe({
      next: (rows: any[]) => { this.proyectos = rows || []; this.cdr.detectChanges(); },
      error: () => { this.proyectos = []; this.cdr.detectChanges(); }
    });

    this.proveedoresService.proveedores(true).subscribe({
      next: (rows: any[]) => { this.proveedores = rows || []; this.cdr.detectChanges(); },
      error: () => { this.proveedores = []; this.cdr.detectChanges(); }
    });
  }

  load(): void {
    this.loading = true;
    this.gastoProyectoService.listar(this.tipoModulo, {
      idProyecto: this.filtros.idProyecto || null,
      concepto: this.filtros.concepto || null,
      estado: this.filtros.estado || null
    }).subscribe({
      next: (rows: any[]) => {
        this.rows = (rows || []).map((row: any) => this.normalizarRow(row));
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.rows = [];
        this.loading = false;
        this.notifications.show(err?.error?.message || 'No se pudo cargar Terreno.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  guardar(): void {
    if (!this.form.idProyecto) { this.notifications.show('Debes seleccionar un proyecto.', 'info'); return; }
    if (!this.form.concepto) { this.notifications.show('Debes seleccionar el concepto.', 'info'); return; }
    if (!(this.toNumber(this.form.montoSoles) > 0 || this.toNumber(this.form.montoDolares) > 0)) { this.notifications.show('Debes ingresar el monto en soles o dólares.', 'info'); return; }

    const payload = {
      idGastoProyecto: this.form.idGastoProyecto,
      idProyecto: Number(this.form.idProyecto),
      idProveedorTerreno: this.form.idProveedorTerreno ? Number(this.form.idProveedorTerreno) : null,
      fecha: this.form.fecha || this.todayIso(),
      concepto: String(this.form.concepto || '').trim().toUpperCase(),
      moneda: String(this.form.moneda || 'PEN'),
      montoSoles: this.toNumber(this.form.montoSoles),
      montoDolares: this.toNumber(this.form.montoDolares),
      fechaTipoCambio: this.normalizarFechaInput(this.form.fechaTipoCambio) || this.todayIso(),
      tipoCambio: this.toNumber(this.form.tipoCambio || this.tipoCambioActual) || this.tipoCambioActual,
      descripcion: String(this.form.descripcion || '').trim(),
      estado: this.form.estado || 'Activo',
      activo: this.form.estado === 'Activo'
    };

    this.gastoProyectoService.guardar(this.tipoModulo, payload).subscribe({
      next: () => {
        this.notifications.show('Registro guardado correctamente.', 'success');
        this.limpiar();
        this.cerrarModal();
        this.load();
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudo guardar el registro.', 'error')
    });
  }

  editar(row: GastoProyectoRow): void {
    this.modalOpen = true;
    const id = Number(row.idGastoProyecto || 0);
    if (!id) return;
    this.gastoProyectoService.obtener(this.tipoModulo, id).subscribe({
      next: (res: any) => {
        const gasto = res?.gasto ?? res ?? row;
        const normalized = this.normalizarRow(gasto);
        this.editandoId = normalized.idGastoProyecto;
        this.form = {
          idGastoProyecto: normalized.idGastoProyecto,
          fecha: this.normalizarFechaInput(normalized.fecha) || this.todayIso(),
          fechaTipoCambio: this.normalizarFechaInput(normalized.fechaTipoCambio) || this.todayIso(),
          idProyecto: normalized.idProyecto,
          idProveedorTerreno: normalized.idProveedorTerreno,
          concepto: normalized.concepto,
          moneda: normalized.moneda || 'PEN',
          montoSoles: normalized.montoSoles || null,
          montoDolares: normalized.montoDolares || null,
          tipoCambio: normalized.tipoCambio || this.tipoCambioActual,
          descripcion: normalized.descripcion,
          estado: normalized.estado || 'Activo'
        };
        this.documentos = res?.documentos ?? [];
        this.selectedFacturaFiles = [];
        this.cdr.detectChanges();
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudo cargar el registro.', 'error')
    });
  }

  cambiarEstado(row: GastoProyectoRow): void {
    const nuevoEstado = row.estado === 'Activo' ? 'Inactivo' : 'Activo';
    this.gastoProyectoService.guardar(this.tipoModulo, {
      ...row,
      estado: nuevoEstado,
      activo: nuevoEstado === 'Activo'
    }).subscribe({
      next: () => {
        this.notifications.show(`Registro ${nuevoEstado === 'Activo' ? 'activado' : 'desactivado'} correctamente.`, 'success');
        this.load();
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudo cambiar el estado.', 'error')
    });
  }

  abrirArchivos(row: GastoProyectoRow): void {
    this.archivosTargetRow = row;
    this.editar(row);
    this.loadDocumentos(row.idGastoProyecto);
  }

  cerrarArchivos(): void {
    this.archivosTargetRow = null;
    this.selectedFacturaFiles = [];
    this.documentos = [];
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFacturaFiles = Array.from(input.files || []).filter(file => file.name.toLowerCase().endsWith('.pdf'));
  }

  uploadFacturas(): void {
    const id = Number(this.form.idGastoProyecto || this.archivosTargetRow?.idGastoProyecto || 0);
    if (!id) { this.notifications.show('Primero guarda el registro para subir facturas.', 'info'); return; }
    if (!this.selectedFacturaFiles.length) { this.notifications.show('Selecciona una o más facturas PDF.', 'info'); return; }

    this.gastoProyectoService.uploadDocumentos(this.tipoModulo, id, this.selectedFacturaFiles).subscribe({
      next: () => {
        this.notifications.show('Facturas subidas correctamente.', 'success');
        this.selectedFacturaFiles = [];
        this.loadDocumentos(id);
        this.load();
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudieron subir las facturas.', 'error')
    });
  }

  loadDocumentos(id: number): void {
    this.gastoProyectoService.documentos(this.tipoModulo, id).subscribe({
      next: rows => { this.documentos = rows ?? []; this.cdr.detectChanges(); },
      error: err => this.notifications.show(err?.error?.message || 'No se pudieron cargar las facturas.', 'error')
    });
  }

  downloadUrl(doc: any): string {
    const id = Number(this.readValue(doc, 'idGastoProyecto', 'IdGastoProyecto') ?? this.form.idGastoProyecto);
    const docId = Number(this.readValue(doc, 'idGastoProyectoDocumento', 'IdGastoProyectoDocumento'));
    return this.gastoProyectoService.documentoDownloadUrl(this.tipoModulo, id, docId);
  }

  onAccion(event: Event, row: GastoProyectoRow): void {
    const value = (event.target as HTMLSelectElement).value;
    (event.target as HTMLSelectElement).value = '';
    if (value === 'edit') this.editar(row);
    if (value === 'archivos') this.abrirArchivos(row);
    if (value === 'estado') this.cambiarEstado(row);
  }

  onFechaTipoCambioChange(fecha: string): void {
    const fechaNormalizada = this.normalizarFechaInput(fecha);
    this.form.fechaTipoCambio = fechaNormalizada;
    this.sunatService.consultarTipoCambio(fechaNormalizada || undefined);
  }

  onDolaresInput(): void {
    const dolares = this.toNumber(this.form.montoDolares);
    if (dolares <= 0) {
      this.form.montoDolares = null;
      return;
    }
    this.syncingFromDolares = true;
    this.form.moneda = 'USD';
    this.form.tipoCambio = this.toNumber(this.form.tipoCambio || this.tipoCambioActual) || this.tipoCambioActual;
    this.form.montoSoles = this.round(dolares * this.form.tipoCambio);
    this.syncingFromDolares = false;
  }

  onSolesInput(): void {
    if (this.syncingFromDolares) return;
    if (this.toNumber(this.form.montoSoles) <= 0) this.form.montoSoles = null;
    this.form.montoDolares = null;
    this.form.moneda = 'PEN';
  }

  limpiar(): void {
    this.editandoId = null;
    this.form = this.createEmptyForm();
    this.cerrarArchivos();
    this.cdr.detectChanges();
  }

  formatMoney(value: any, currency: 'PEN' | 'USD' = 'PEN'): string {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(this.toNumber(value));
  }

  formatFecha(fecha: string | null | undefined): string {
    if (!fecha) return '--/--/----';
    const base = fecha.split('T')[0];
    const partes = base.split('-');
    if (partes.length !== 3) return fecha;
    const [year, month, day] = partes;
    return `${day}/${month}/${year}`;
  }

  totalRegistrado(): number { return this.rows.reduce((acc, row) => acc + this.toNumber(row.montoSoles), 0); }
  totalPorConcepto(nombreConcepto: string): number {
    const match = String(nombreConcepto || '').trim().toUpperCase();
    return this.rows.filter(x => String(x.concepto || '').trim().toUpperCase() === match).reduce((acc, row) => acc + this.toNumber(row.montoSoles), 0);
  }
  registrosActivos(): number { return this.rows.filter(x => x.estado === 'Activo').length; }

  readValue<T = any>(row: any, ...keys: string[]): T | null {
    for (const key of keys) if (row && row[key] !== undefined && row[key] !== null) return row[key] as T;
    return null;
  }

  private normalizarRow(row: any): GastoProyectoRow {
    return {
      idGastoProyecto: Number(this.readValue(row, 'idGastoProyecto', 'IdGastoProyecto') || 0),
      fecha: String(this.readValue(row, 'fecha', 'Fecha') || this.todayIso()),
      fechaTipoCambio: this.readValue(row, 'fechaTipoCambio', 'FechaTipoCambio'),
      idProyecto: Number(this.readValue(row, 'idProyecto', 'IdProyecto') || 0) || null,
      proyecto: String(this.readValue(row, 'proyecto', 'Proyecto', 'nombreProyecto', 'NombreProyecto') || '-'),
      idProveedorTerreno: Number(this.readValue(row, 'idProveedorTerreno', 'IdProveedorTerreno') || 0) || null,
      proveedor: String(this.readValue(row, 'proveedor', 'Proveedor') || '-'),
      concepto: String(this.readValue(row, 'concepto', 'Concepto') || '').trim().toUpperCase(),
      moneda: String(this.readValue(row, 'moneda', 'Moneda') || 'PEN'),
      montoSoles: this.toNumber(this.readValue(row, 'montoSoles', 'MontoSoles')),
      montoDolares: this.toNumber(this.readValue(row, 'montoDolares', 'MontoDolares')),
      tipoCambio: this.toNumber(this.readValue(row, 'tipoCambio', 'TipoCambio')) || this.tipoCambioActual,
      descripcion: String(this.readValue(row, 'descripcion', 'Descripcion') || ''),
      estado: String(this.readValue(row, 'estado', 'Estado') || 'Activo'),
      activo: Boolean(this.readValue(row, 'activo', 'Activo') ?? true),
      totalFacturas: Number(this.readValue(row, 'totalFacturas', 'TotalFacturas') || 0)
    };
  }

  private todayIso(): string {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  private normalizarFechaInput(fecha: string | null | undefined): string {
    if (!fecha) return '';
    const base = String(fecha).split('T')[0];
    const partes = base.split('-');
    return partes.length === 3 ? base : '';
  }

  private toNumber(value: any): number {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? this.round(number) : 0;
  }

  private round(value: number): number { return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100; }
}
