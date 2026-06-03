import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GastosAdministrativosService } from '../../core/services/gastos-administrativos.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  standalone: true,
  selector: 'app-categorias-gasto-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './categorias-gasto.page.html',
  styleUrl: './categorias-gasto.page.css'
})
export class CategoriasGastoPage implements OnInit {
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

  loading = false;
  filtroActivo: string = 'true';
  form: any = this.createEmptyForm();

  constructor(
    private gastosService: GastosAdministrativosService,
    private notifications: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  createEmptyForm() {
    return { idCategoriaGasto: null, nombre: '', activo: true };
  }

  load(): void {
    this.loading = true;
    const activo = this.filtroActivo === '' ? null : this.filtroActivo === 'true';
    this.gastosService.categorias(activo).subscribe({
      next: rows => {
        this.rows = rows ?? [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.loading = false;
        this.notifications.show(err?.error?.message || 'No se pudieron cargar las categorías.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  edit(row: any): void {
    this.modalOpen = true;
    this.form = {
      idCategoriaGasto: row.idCategoriaGasto,
      nombre: row.nombre ?? '',
      activo: row.activo ?? true
    };
  }

  reset(): void {
    this.form = this.createEmptyForm();
  }

  save(): void {
    const nombre = String(this.form.nombre ?? '').trim();
    if (!nombre) {
      this.notifications.show('Ingresa el nombre de la categoría.', 'info');
      return;
    }

    this.gastosService.guardarCategoria({
      ...this.form,
      nombre
    }).subscribe({
      next: () => {
        this.notifications.show('Categoría guardada correctamente.', 'success');
        this.reset();
        this.cerrarModal();
        this.load();
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudo guardar la categoría.', 'error')
    });
  }

  onAccion(event: Event, row: any): void {
    const value = (event.target as HTMLSelectElement).value;
    (event.target as HTMLSelectElement).value = '';
    if (value === 'edit') this.edit(row);
    if (value === 'estado') this.remove(row);
  }

  remove(row: any): void {
    if (!confirm(`¿Desactivar la categoría ${row.nombre}?`)) return;
    this.gastosService.desactivarCategoria(row.idCategoriaGasto).subscribe({
      next: () => {
        this.notifications.show('Categoría desactivada correctamente.', 'success');
        if (this.form.idCategoriaGasto === row.idCategoriaGasto) this.reset();
        this.cerrarModal();
        this.load();
      },
      error: err => this.notifications.show(err?.error?.message || 'No se pudo desactivar la categoría.', 'error')
    });
  }
}
