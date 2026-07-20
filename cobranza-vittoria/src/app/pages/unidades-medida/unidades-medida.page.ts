import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaestraService } from '../../core/services/maestra.service';
import { NotificationService } from '../../core/services/notification.service';
import { ImportModalComponent } from '../../shared/components/import-modal/import-modal.component';

@Component({
  standalone: true,
  selector: 'app-unidades-medida-page',
  imports: [CommonModule, FormsModule, ImportModalComponent],
  templateUrl: './unidades-medida.page.html',
  styleUrl: './unidades-medida.page.css'
})
export class UnidadesMedidaPage implements OnInit {
  modalOpen = false;
  importOpen = false;

  abrirModalNuevo(): void {
    this.reset();
    this.modalOpen = true;
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.modalOpen = false;
    this.cdr.detectChanges();
  }

  abrirImportModal(): void {
    this.importOpen = true;
    this.cdr.detectChanges();
  }

  cerrarImportModal(): void {
    this.importOpen = false;
    this.cdr.detectChanges();
  }

  onImportSuccess(): void {
    this.cerrarImportModal();
    this.load();
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

  filtroActivo: boolean | null = null;
  msg = '';
  form: any = { idUnidadMedida: null, codigo: '', nombre: '', activo: true };

  constructor(
    private maestra: MaestraService,
    private notifyService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() { this.load(); }

  load() {
    this.maestra.unidadesMedida(this.filtroActivo).subscribe(x => {
      this.rows = x || [];
      this.cdr.detectChanges();
    });
  }

  edit(row: any) {
    this.modalOpen = true;
    this.form = {
      idUnidadMedida: row.idUnidadMedida ?? null,
      codigo: row.codigo ?? '',
      nombre: row.nombre ?? '',
      activo: row.activo ?? true
    };
  }

  reset() {
    this.form = { idUnidadMedida: null, codigo: '', nombre: '', activo: true };
    this.msg = '';
  }

  save() {
    const payload = {
      idUnidadMedida: this.form.idUnidadMedida ? Number(this.form.idUnidadMedida) : null,
      codigo: (this.form.codigo ?? '').toString().trim(),
      nombre: (this.form.nombre ?? '').toString().trim(),
      activo: !!this.form.activo
    };

    if (!payload.codigo) {
      this.msg = 'Debes ingresar el código.';
      this.notifyService.show(this.msg, 'error');
      return;
    }

    if (!payload.nombre) {
      this.msg = 'Debes ingresar el nombre.';
      this.notifyService.show(this.msg, 'error');
      return;
    }

    this.maestra.guardarUnidadMedida(payload).subscribe({
      next: () => {
        this.msg = payload.idUnidadMedida ? 'Unidad de medida actualizada correctamente.' : 'Unidad de medida guardada correctamente.';
        this.notifyService.show(this.msg, 'success');
        this.reset();
        this.cerrarModal();
        this.load();
        this.cdr.detectChanges();
      },
      error: e => {
        this.msg = e?.error?.message || 'No se pudo guardar la unidad de medida.';
        this.notifyService.show(this.msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }
}
