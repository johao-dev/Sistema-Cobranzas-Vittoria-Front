import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GastosAdministrativosService } from '../../core/services/gastos-administrativos.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  standalone: true,
  selector: 'app-gastos-administrativos-page',
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './gastos-administrativos.page.html',
  styleUrl: './gastos-administrativos.page.css'
})
export class GastosAdministrativosPage implements OnInit {
  rows: any[] = [];
  categorias: any[] = [];
  proveedores: any[] = [];
  documentos: any[] = [];
  loading = false;

  filtros: any = {
    idCategoriaGasto: '',
    idProveedorGastoAdministrativo: '',
    activo: 'true'
  };

  form: any = this.createEmptyForm();
  selectedFacturaFiles: File[] = [];
  selectedPagoFiles: File[] = [];
  archivosTargetRow: any = null;

  constructor(
    private gastosService: GastosAdministrativosService,
    private notifications: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCatalogos();
    this.load();
  }

  createEmptyForm() {
    return {
      idGastoAdministrativo: null,
      fecha: this.todayForInput(),
      idCategoriaGasto: null,
      idProveedorGastoAdministrativo: null,
      monto: null,
      moneda: 'PEN',
      descripcion: '',
      activo: true
    };
  }

  todayForInput(): string {
    const now = new Date();
    const m = `${now.getMonth() + 1}`.padStart(2, '0');
    const d = `${now.getDate()}`.padStart(2, '0');
    return `${now.getFullYear()}-${m}-${d}`;
  }

  readValue<T = any>(row: any, ...keys: string[]): T | null {
    for (const key of keys) {
      if (row && row[key] !== undefined && row[key] !== null) return row[key] as T;
    }
    return null;
  }

  get proveedoresFormFiltrados(): any[] {
    const categoriaId = Number(this.form.idCategoriaGasto) || null;
    if (!categoriaId) return [];
    return this.proveedores.filter(p => Number(this.readValue(p, 'idCategoriaGasto', 'IdCategoriaGasto')) === categoriaId);
  }

  get proveedoresFiltroFiltrados(): any[] {
    const categoriaId = Number(this.filtros.idCategoriaGasto) || null;
    if (!categoriaId) return this.proveedores;
    return this.proveedores.filter(p => Number(this.readValue(p, 'idCategoriaGasto', 'IdCategoriaGasto')) === categoriaId);
  }

  onCategoriaFormularioChange(): void {
    const categoriaId = Number(this.form.idCategoriaGasto) || null;
    const proveedorId = Number(this.form.idProveedorGastoAdministrativo) || null;
    if (!categoriaId) {
      this.form.idProveedorGastoAdministrativo = null;
      return;
    }
    const ok = this.proveedores.some(p => Number(this.readValue(p, 'idProveedorGastoAdministrativo', 'IdProveedorGastoAdministrativo')) === proveedorId && Number(this.readValue(p, 'idCategoriaGasto', 'IdCategoriaGasto')) === categoriaId);
    if (!ok) this.form.idProveedorGastoAdministrativo = null;
  }

  get sumatoriaPagosVisibles(): number {
    return (this.rows || []).reduce((acc: number, row: any) => acc + Number(this.readValue(row, 'total', 'Total', 'monto', 'Monto') || 0), 0);
  }

  onCategoriaFiltroChange(): void {
    const categoriaId = Number(this.filtros.idCategoriaGasto) || null;
    const proveedorId = Number(this.filtros.idProveedorGastoAdministrativo) || null;
    if (!categoriaId) {
      this.filtros.idProveedorGastoAdministrativo = '';
      this.load();
      return;
    }
    const ok = this.proveedores.some(p => Number(this.readValue(p, 'idProveedorGastoAdministrativo', 'IdProveedorGastoAdministrativo')) === proveedorId && Number(this.readValue(p, 'idCategoriaGasto', 'IdCategoriaGasto')) === categoriaId);
    if (!ok) this.filtros.idProveedorGastoAdministrativo = '';
    this.load();
  }

  abrirArchivos(row: any): void {
    this.edit(row);
    this.archivosTargetRow = row;
  }

  cerrarArchivos(): void {
    this.archivosTargetRow = null;
    this.selectedFacturaFiles = [];
    this.selectedPagoFiles = [];
  }

  loadCatalogos(): void {
    this.gastosService.categorias(true).subscribe({
      next: rows => {
        this.categorias = rows ?? [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.categorias = [];
        this.cdr.detectChanges();
      }
    });

    this.gastosService.proveedores(true).subscribe({
      next: rows => {
        this.proveedores = rows ?? [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.proveedores = [];
        this.cdr.detectChanges();
      }
    });
  }

  load(): void {
    this.loading = true;
    const activo = this.filtros.activo === '' ? null : this.filtros.activo === 'true';
    this.gastosService.gastos({
      idCategoriaGasto: this.filtros.idCategoriaGasto || null,
      idProveedorGastoAdministrativo: this.filtros.idProveedorGastoAdministrativo || null,
      activo
    }).subscribe({
      next: rows => {
        this.rows = rows ?? [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.loading = false;
        this.rows = [];
        this.notifications.show(err?.error?.message || 'No se pudieron cargar los gastos administrativos.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  edit(row: any): void {
    const id = this.readValue<number>(row, 'idGastoAdministrativo', 'IdGastoAdministrativo');
    if (!id) return;

    this.gastosService.gasto(id).subscribe({
      next: res => {
        const gasto = res?.gasto ?? res ?? row;
        this.form = {
          idGastoAdministrativo: this.readValue(gasto, 'idGastoAdministrativo', 'IdGastoAdministrativo'),
          fecha: this.normalizeDateInput(this.readValue(gasto, 'fecha', 'Fecha')),
          idCategoriaGasto: Number(this.readValue(gasto, 'idCategoriaGasto', 'IdCategoriaGasto')) || null,
          idProveedorGastoAdministrativo: Number(this.readValue(gasto, 'idProveedorGastoAdministrativo', 'IdProveedorGastoAdministrativo')) || null,
          monto: Number(this.readValue(gasto, 'monto', 'Monto')) || null,
          moneda: String(this.readValue(gasto, 'moneda', 'Moneda') ?? 'PEN'),
          descripcion: String(this.readValue(gasto, 'descripcion', 'Descripcion') ?? ''),
          activo: Boolean(this.readValue(gasto, 'activo', 'Activo') ?? true)
        };
        this.documentos = res?.documentos ?? [];
        this.selectedFacturaFiles = [];
        this.selectedPagoFiles = [];
        this.cdr.detectChanges();
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudo cargar el gasto seleccionado.', 'error')
    });
  }

  normalizeDateInput(value: any): string {
    if (!value) return this.todayForInput();
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.substring(0, 10);
    const parsed = new Date(text);
    if (!isNaN(parsed.getTime())) {
      const m = `${parsed.getMonth() + 1}`.padStart(2, '0');
      const d = `${parsed.getDate()}`.padStart(2, '0');
      return `${parsed.getFullYear()}-${m}-${d}`;
    }
    return this.todayForInput();
  }

  reset(): void {
    this.form = this.createEmptyForm();
    this.documentos = [];
    this.selectedFacturaFiles = [];
    this.selectedPagoFiles = [];
    this.archivosTargetRow = null;
  }

  save(): void {
    if (!this.form.idCategoriaGasto) {
      this.notifications.show('Selecciona una categoría.', 'info');
      return;
    }
    if (!this.form.idProveedorGastoAdministrativo) {
      this.notifications.show('Selecciona un proveedor.', 'info');
      return;
    }
    if (!(Number(this.form.monto) > 0)) {
      this.notifications.show('Ingresa un monto válido.', 'info');
      return;
    }

    const payload = {
      idGastoAdministrativo: this.form.idGastoAdministrativo,
      idCategoriaGasto: Number(this.form.idCategoriaGasto),
      idProveedorGastoAdministrativo: Number(this.form.idProveedorGastoAdministrativo),
      fecha: this.form.fecha,
      monto: Number(this.form.monto),
      descripcion: String(this.form.descripcion ?? '').trim(),
      moneda: String(this.form.moneda ?? 'PEN'),
      activo: !!this.form.activo
    };

    this.gastosService.guardarGasto(payload).subscribe({
      next: res => {
        const id = res?.idGastoAdministrativo ?? res?.IdGastoAdministrativo ?? this.form.idGastoAdministrativo;
        this.form.idGastoAdministrativo = id;
        this.notifications.show('Gasto administrativo guardado correctamente.', 'success');
        this.load();
        if (id) this.loadDocumentos(id);
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudo guardar el gasto administrativo.', 'error')
    });
  }

  loadDocumentos(id: number): void {
    this.gastosService.documentos(id).subscribe({
      next: rows => {
        this.documentos = rows ?? [];
        this.cdr.detectChanges();
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudieron cargar los documentos.', 'error')
    });
  }

  remove(row: any): void {
    const id = this.readValue<number>(row, 'idGastoAdministrativo', 'IdGastoAdministrativo');
    const proveedor = this.readValue<string>(row, 'proveedor', 'Proveedor') ?? 'seleccionado';
    if (!id) return;
    if (!confirm(`¿Desactivar el gasto del proveedor ${proveedor}?`)) return;

    this.gastosService.desactivarGasto(id).subscribe({
      next: () => {
        this.notifications.show('Gasto administrativo desactivado.', 'success');
        if (this.form.idGastoAdministrativo === id) this.reset();
        this.load();
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudo desactivar el gasto.', 'error')
    });
  }

  onFilesSelected(event: Event, tipo: 'Factura' | 'Pago'): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []).filter(file => file.name.toLowerCase().endsWith('.pdf'));
    if (tipo === 'Factura') this.selectedFacturaFiles = files;
    else this.selectedPagoFiles = files;
  }

  upload(tipo: 'Factura' | 'Pago'): void {
    const id = this.form.idGastoAdministrativo;
    if (!id) {
      this.notifications.show('Primero guarda el gasto para poder subir documentos.', 'info');
      return;
    }

    const files = tipo === 'Factura' ? this.selectedFacturaFiles : this.selectedPagoFiles;
    if (!files.length) {
      this.notifications.show(`Selecciona uno o más PDFs de ${tipo.toLowerCase()} antes de subirlos.`, 'info');
      return;
    }

    this.gastosService.uploadDocumentos(id, tipo, files).subscribe({
      next: () => {
        this.notifications.show(`Documentos de ${tipo.toLowerCase()} subidos correctamente.`, 'success');
        if (tipo === 'Factura') this.selectedFacturaFiles = [];
        else this.selectedPagoFiles = [];
        this.loadDocumentos(id);
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudieron subir los documentos.', 'error')
    });
  }

  documentosPorTipo(tipo: 'Factura' | 'Pago'): any[] {
    return (this.documentos || []).filter(doc => String(this.readValue(doc, 'tipoDocumento', 'TipoDocumento') ?? '').toLowerCase() === tipo.toLowerCase());
  }

  downloadUrl(doc: any): string {
    const gastoId = Number(this.readValue(doc, 'idGastoAdministrativo', 'IdGastoAdministrativo') ?? this.form.idGastoAdministrativo);
    const docId = Number(this.readValue(doc, 'idGastoAdministrativoDocumento', 'IdGastoAdministrativoDocumento'));
    return this.gastosService.documentoDownloadUrl(gastoId, docId);
  }
}
