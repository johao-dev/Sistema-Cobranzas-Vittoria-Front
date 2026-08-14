import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../core/services/notification.service';
import { MaestraService } from '../../core/services/maestra.service';
import { KardexService } from '../../core/services/kardex.service';

@Component({
  standalone: true,
  selector: 'app-kardex-entradas-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './kardex-entradas.page.html',
  styleUrl: './kardex-entradas.page.css'
})
export class KardexEntradasPage implements OnInit {
  modalOpen = false;

  abrirModalNuevo(): void {
    this.reset();
    this.modalOpen = true;
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.modalOpen = false;
    this.cdr.detectChanges();
  }

  rows: any[] = [];
  filtroBusqueda = '';

  filtros = {
    idEspecialidad: null as number | null,
    idProyecto: null as number | null,
    fechaDesde: '',
    fechaHasta: ''
  };

  private normalizarBusqueda(valor: any): string {
    return (valor ?? '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  get rowsFiltradas(): any[] {
    const termino = this.normalizarBusqueda(this.filtroBusqueda);
    if (!termino) return this.rows ?? [];

    return (this.rows ?? []).filter(row =>
      this.normalizarBusqueda(Object.values(row ?? {}).join(' ')).includes(termino)
    );
  }

  especialidades: any[] = [];
  proveedores: any[] = [];
  proyectos: any[] = [];
  msg = '';

  form: any = this.crearFormVacio();

  get cantidadInvalida(): boolean {
    const n = Number(this.form?.cantidad);
    return !Number.isFinite(n) || n < 0;
  }

  constructor(
    private maestra: MaestraService,
    private kardex: KardexService,
    private notifyService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.maestra.especialidades(true).subscribe({
      next: (x: any) => { this.especialidades = x ?? []; this.cdr.detectChanges(); },
      error: () => { this.especialidades = []; this.cdr.detectChanges(); }
    });

    this.maestra.proveedores(true).subscribe({
      next: (x: any) => { this.proveedores = x ?? []; this.cdr.detectChanges(); },
      error: () => { this.proveedores = []; this.cdr.detectChanges(); }
    });

    this.maestra.proyectos(true).subscribe({
      next: (x: any) => { this.proyectos = x ?? []; this.cdr.detectChanges(); },
      error: () => { this.proyectos = []; this.cdr.detectChanges(); }
    });

    this.load();
  }

  load() {
    this.kardex.entradas({
      idEspecialidad: this.filtros.idEspecialidad,
      idProyecto: this.filtros.idProyecto,
      fechaDesde: this.filtros.fechaDesde || null,
      fechaHasta: this.filtros.fechaHasta || null
    }).subscribe({
      next: (x: any) => {
        this.rows = (x || []).map((row: any) => this.normalizarEntrada(row));
        this.cdr.detectChanges();
      },
      error: () => {
        this.rows = [];
        this.cdr.detectChanges();
      }
    });
  }

  limpiarFiltros() {
    this.filtros = {
      idEspecialidad: null,
      idProyecto: null,
      fechaDesde: '',
      fechaHasta: ''
    };
    this.load();
  }

  edit(row: any) {
    this.modalOpen = true;
    this.form = this.normalizarEntrada(row);
    this.msg = '';
    this.cdr.detectChanges();
  }

  delete(row: any) {
    const id = this.toNumberOrNull(this.read(row, ['idKardexEntrada', 'IdKardexEntrada', 'id', 'Id']));
    if (!id) {
      this.notifyService.show('No se pudo identificar el registro a eliminar.', 'error');
      return;
    }

    const nombre = this.read(row, ['nombre', 'Nombre']) || 'este registro';
    if (!confirm(`¿Eliminar la entrada de "${nombre}"? Esta acción no se puede deshacer.`)) return;

    this.kardex.eliminarEntrada(id).subscribe({
      next: () => {
        this.notifyService.show('Entrada eliminada correctamente.', 'success');
        this.load();
      },
      error: (e: any) => {
        this.notifyService.show(e?.error?.message || 'No se pudo eliminar la entrada.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  reset() {
    this.form = this.crearFormVacio();
    this.msg = '';
    this.cdr.detectChanges();
  }

  onCantidadInput() {
    const n = Number(this.form.cantidad);
    if (this.form.cantidad !== null && this.form.cantidad !== undefined && this.form.cantidad !== '' && (Number.isNaN(n) || n < 0)) {
      this.form.cantidad = 0;
    }
  }

  save() {
    const payload = {
      idKardexEntrada: this.form.idKardexEntrada ? Number(this.form.idKardexEntrada) : null,
      idEspecialidad: this.form.idEspecialidad != null ? Number(this.form.idEspecialidad) : null,
      idProveedor: this.form.idProveedor != null ? Number(this.form.idProveedor) : null,
      numeroDocumento: (this.form.numeroDocumento ?? '').toString().trim(),
      fecha: this.form.fecha || null,
      codigoMaterial: (this.form.codigoMaterial ?? '').toString().trim(),
      nombre: (this.form.nombre ?? '').toString().trim(),
      cantidad: Number(this.form.cantidad || 0),
      observacion: (this.form.observacion ?? '').toString().trim()
    };

    if (!payload.idEspecialidad) {
      this.msg = 'Debes seleccionar una especialidad.';
      this.notifyService.show(this.msg, 'error');
      return;
    }
    if (!payload.nombre) {
      this.msg = 'Debes ingresar el nombre del producto.';
      this.notifyService.show(this.msg, 'error');
      return;
    }
    if (!payload.fecha) {
      this.msg = 'Debes seleccionar la fecha.';
      this.notifyService.show(this.msg, 'error');
      return;
    }
    if (payload.cantidad < 0) {
      this.msg = 'La cantidad no puede ser negativa.';
      this.notifyService.show(this.msg, 'error');
      return;
    }

    this.kardex.guardarEntrada(payload).subscribe({
      next: (resp: any) => {
        this.msg = payload.idKardexEntrada
          ? 'Entrada actualizada correctamente.'
          : 'Entrada registrada correctamente.';
        this.notifyService.show(this.msg, 'success');
        this.reset();
        this.cerrarModal();
        this.load();
      },
      error: (e: any) => {
        this.msg = e?.error?.message || 'No se pudo guardar la entrada.';
        this.notifyService.show(this.msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  formatFecha(value: any): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('es-PE');
  }

  formatCantidad(value: any): string {
    const n = Number(value || 0);
    if (Number.isNaN(n)) return '0';
    return n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  getProyectoLabel(p: any): string {
    return this.read(p, ['nombre', 'Nombre', 'nombreProyecto', 'NombreProyecto']) ?? '';
  }

  private crearFormVacio(): any {
    return {
      idKardexEntrada: null,
      idEspecialidad: null,
      idProveedor: null,
      numeroDocumento: '',
      fecha: new Date().toISOString().slice(0, 10),
      codigoMaterial: '',
      nombre: '',
      cantidad: 0,
      observacion: ''
    };
  }

  private normalizarEntrada(row: any): any {
    if (!row) return this.crearFormVacio();

    return {
      idKardexEntrada: this.toNumberOrNull(this.read(row, ['idKardexEntrada', 'IdKardexEntrada', 'id', 'Id'])),
      idEspecialidad: this.toNumberOrNull(this.read(row, ['idEspecialidad', 'IdEspecialidad'])),
      especialidad: this.read(row, ['especialidad', 'Especialidad', 'nombreEspecialidad', 'NombreEspecialidad']) ?? '',
      idProveedor: this.toNumberOrNull(this.read(row, ['idProveedor', 'IdProveedor'])),
      proveedor: this.read(row, ['proveedor', 'Proveedor', 'razonSocial', 'RazonSocial']) ?? '',
      numeroDocumento: this.read(row, ['numeroDocumento', 'NumeroDocumento', 'nroDocumento', 'NroDocumento']) ?? '',
      fecha: this.formatFechaInput(this.read(row, ['fecha', 'Fecha'])),
      codigoMaterial: this.read(row, ['codigoMaterial', 'CodigoMaterial']) ?? '',
      nombre: this.read(row, ['nombre', 'Nombre', 'material', 'Material']) ?? '',
      cantidad: this.toNumberOrDefault(this.read(row, ['cantidad', 'Cantidad']), 0),
      observacion: this.read(row, ['observacion', 'Observacion', 'observaciones', 'Observaciones']) ?? ''
    };
  }

  private formatFechaInput(value: any): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().slice(0, 10);
  }

  private read(obj: any, keys: string[]): any {
    if (!obj) return null;
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    const lowerMap = Object.keys(obj).reduce((acc: any, key: string) => {
      acc[key.toLowerCase()] = obj[key];
      return acc;
    }, {});
    for (const key of keys) {
      const value = lowerMap[key.toLowerCase()];
      if (value !== undefined && value !== null) return value;
    }
    return null;
  }

  private toNumberOrNull(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private toNumberOrDefault(value: any, fallback: number): number {
    const n = this.toNumberOrNull(value);
    return n === null ? fallback : n;
  }
}
