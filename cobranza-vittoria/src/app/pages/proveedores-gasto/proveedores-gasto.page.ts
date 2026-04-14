import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GastosAdministrativosService } from '../../core/services/gastos-administrativos.service';
import { NotificationService } from '../../core/services/notification.service';
import { MaestraService } from '../../core/services/maestra.service';

@Component({
  standalone: true,
  selector: 'app-proveedores-gasto-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './proveedores-gasto.page.html',
  styleUrl: './proveedores-gasto.page.css'
})
export class ProveedoresGastoPage implements OnInit {
  rows: any[] = [];
  categorias: any[] = [];
  loading = false;
  filtroActivo: string = 'true';
  filtroCategoria: string = '';
  form: any = this.createEmptyForm();

  constructor(
    private gastosService: GastosAdministrativosService,
    private notifications: NotificationService,
    private cdr: ChangeDetectorRef,
    private maestra: MaestraService
  ) {}

  ngOnInit(): void {
    this.loadCatalogos();
    this.load();
  }

  createEmptyForm() {
    return {
      idProveedorGastoAdministrativo: null,
      idCategoriaGasto: null,
      razonSocial: '',
      ruc: '',
      telefono: '',
      correo: '',
      activo: true
    };
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
  }

  readValue<T = any>(row: any, ...keys: string[]): T | null {
    for (const key of keys) {
      if (row && row[key] !== undefined && row[key] !== null) return row[key] as T;
    }
    return null;
  }

  load(): void {
    this.loading = true;
    const activo = this.filtroActivo === '' ? null : this.filtroActivo === 'true';
    const categoriaId = this.filtroCategoria ? Number(this.filtroCategoria) : null;
    this.gastosService.proveedores(activo, categoriaId).subscribe({
      next: rows => {
        this.rows = rows ?? [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.loading = false;
        this.notifications.show(err?.error?.message || 'No se pudieron cargar los proveedores de gasto.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  edit(row: any): void {
    this.form = {
      idProveedorGastoAdministrativo: this.readValue(row, 'idProveedorGastoAdministrativo', 'IdProveedorGastoAdministrativo'),
      idCategoriaGasto: Number(this.readValue(row, 'idCategoriaGasto', 'IdCategoriaGasto')) || null,
      razonSocial: this.readValue(row, 'razonSocial', 'RazonSocial') ?? '',
      ruc: this.readValue(row, 'ruc', 'Ruc') ?? '',
      telefono: this.readValue(row, 'telefono', 'Telefono') ?? '',
      correo: this.readValue(row, 'correo', 'Correo') ?? '',
      activo: this.readValue(row, 'activo', 'Activo') ?? true
    };
  }

  reset(): void {
    this.form = this.createEmptyForm();
  }

  buscarRuc() {
    if (!this.form.ruc || this.form.ruc.toString().trim().length !== 11) {
      return;
    }

    this.maestra.consultaRuc(this.form.ruc).subscribe({
      next: (res: any) => {
        if (res && res.numero_documento) {
          this.form.razonSocial = res.razon_social || '';
          this.form.activo = res.estado === 'ACTIVO';
          
          this.notifications.show('Datos recuperados de SUNAT correctamente.', 'success');
        } else {
          this.notifications.show('No se encontraron datos para el RUC ingresado.', 'info');
        }
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.notifications.show('Error al consultar el RUC. Verifique el número ingresado.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  save(): void {
    const razonSocial = String(this.form.razonSocial ?? '').trim();
    if (!this.form.idCategoriaGasto) {
      this.notifications.show('Selecciona la categoría del proveedor de gasto.', 'info');
      return;
    }
    if (!razonSocial) {
      this.notifications.show('Ingresa la razón social del proveedor.', 'info');
      return;
    }

    this.gastosService.guardarProveedor({
      ...this.form,
      idCategoriaGasto: Number(this.form.idCategoriaGasto),
      razonSocial,
      ruc: String(this.form.ruc ?? '').trim(),
      telefono: String(this.form.telefono ?? '').trim(),
      correo: String(this.form.correo ?? '').trim()
    }).subscribe({
      next: () => {
        this.notifications.show('Proveedor de gasto guardado correctamente.', 'success');
        this.reset();
        this.load();
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudo guardar el proveedor de gasto.', 'error')
    });
  }

  remove(row: any): void {
    const nombre = this.readValue(row, 'razonSocial', 'RazonSocial') ?? 'seleccionado';
    const id = this.readValue<number>(row, 'idProveedorGastoAdministrativo', 'IdProveedorGastoAdministrativo');
    if (!id) return;
    if (!confirm(`¿Desactivar el proveedor ${nombre}?`)) return;
    this.gastosService.desactivarProveedor(id).subscribe({
      next: () => {
        this.notifications.show('Proveedor desactivado correctamente.', 'success');
        if (this.form.idProveedorGastoAdministrativo === id) this.reset();
        this.load();
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudo desactivar el proveedor.', 'error')
    });
  }
}
