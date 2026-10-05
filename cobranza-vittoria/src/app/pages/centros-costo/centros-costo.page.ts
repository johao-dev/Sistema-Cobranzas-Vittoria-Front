import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlPresupuestarioService } from '../../core/services/control-presupuestario.service';
import { MaestraService } from '../../core/services/maestra.service';
import { NotificationService } from '../../core/services/notification.service';
import { ImportModalComponent } from '../../shared/components/import-modal/import-modal.component';

@Component({
  standalone: true,
  selector: 'app-centros-costo-page',
  imports: [CommonModule, FormsModule, ImportModalComponent],
  templateUrl: './centros-costo.page.html',
  styleUrl: './centros-costo.page.css'
})
export class CentrosCostoPage implements OnInit {
  rows: any[] = [];
  tipos: any[] = [];
  proyectos: any[] = [];

  loading = false;
  modalOpen = false;
  guardando = false;
  importOpen = false;

  filtroActivo = 'true';
  filtroTipo = '';
  filtroBusqueda = '';

  form: any = this.formVacio();

  constructor(
    private cp: ControlPresupuestarioService,
    private maestra: MaestraService,
    private notifications: NotificationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.cargarCatalogos();
    this.load();
  }

  formVacio() {
    return {
      idCentroCosto: null,
      codigo: '',
      nombre: '',
      idTipoCentroCosto: '',
      idProyecto: '',
      descripcion: '',
      activo: true
    };
  }

  /** El tipo PROYECTO exige un proyecto asociado; los demás no lo admiten. */
  get requiereProyecto(): boolean {
    const tipo = this.tipos.find(t => String(t.idTipoCentroCosto) === String(this.form.idTipoCentroCosto));
    return (tipo?.codigo ?? '').toUpperCase() === 'PROYECTO';
  }

  get esEdicion(): boolean {
    return !!this.form.idCentroCosto;
  }

  private normalizar(valor: any): string {
    return (valor ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  get rowsFiltradas(): any[] {
    const termino = this.normalizar(this.filtroBusqueda);
    if (!termino) return this.rows ?? [];
    return (this.rows ?? []).filter(row =>
      this.normalizar([row.codigo, row.nombre, row.nombreProyecto, row.nombreTipoCentroCosto].join(' '))
        .includes(termino));
  }

  cargarCatalogos(): void {
    this.cp.catalogos().subscribe({
      next: data => {
        this.tipos = data?.tiposCentroCosto ?? [];
        this.cdr.detectChanges();
      },
      error: () => this.notifications.show('No se pudieron cargar los catálogos del módulo.', 'error')
    });

    this.maestra.proyectos(true).subscribe({
      next: rows => {
        this.proyectos = rows ?? [];
        this.cdr.detectChanges();
      },
      error: () => this.notifications.show('No se pudieron cargar los proyectos.', 'error')
    });
  }

  abrirImportModal(): void {
    this.importOpen = true;
    this.cdr.detectChanges();
  }

  cerrarImportModal(): void {
    this.importOpen = false;
    this.cdr.detectChanges();
  }

  onImportado(): void {
    this.importOpen = false;
    this.load();
  }

  /** Proyectos activos que aún no tienen centro de costo (los únicos que admite la importación). */
  get proyectosDisponibles(): any[] {
    const usados = new Set(this.rows.map(r => r.idProyecto).filter(Boolean));
    return this.proyectos.filter(p => p.activo !== false && !usados.has(p.idProyecto));
  }

  load(): void {
    this.loading = true;
    const activo = this.filtroActivo === '' ? null : this.filtroActivo === 'true';
    const tipo = this.filtroTipo === '' ? null : Number(this.filtroTipo);

    this.cp.centrosCosto(activo, tipo, null).subscribe({
      next: rows => {
        this.rows = rows ?? [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.loading = false;
        this.notifications.show(err?.error?.message || 'No se pudieron cargar los centros de costo.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  abrirModalNuevo(): void {
    this.form = this.formVacio();
    this.modalOpen = true;
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.modalOpen = false;
    this.cdr.detectChanges();
  }

  edit(row: any): void {
    this.form = {
      idCentroCosto: row.idCentroCosto,
      codigo: row.codigo ?? '',
      nombre: row.nombre ?? '',
      idTipoCentroCosto: row.idTipoCentroCosto ?? '',
      idProyecto: row.idProyecto ?? '',
      descripcion: row.descripcion ?? '',
      activo: row.activo ?? true
    };
    this.modalOpen = true;
    this.cdr.detectChanges();
  }

  onTipoChange(): void {
    if (!this.requiereProyecto) this.form.idProyecto = '';
    this.cdr.detectChanges();
  }

  save(): void {
    if (!this.esEdicion && !String(this.form.codigo ?? '').trim()) {
      this.notifications.show('Ingresa el código del centro de costo.', 'info');
      return;
    }
    if (!String(this.form.nombre ?? '').trim()) {
      this.notifications.show('Ingresa el nombre del centro de costo.', 'info');
      return;
    }
    if (!this.esEdicion && !this.form.idTipoCentroCosto) {
      this.notifications.show('Selecciona el tipo de centro de costo.', 'info');
      return;
    }
    if (this.requiereProyecto && !this.form.idProyecto) {
      this.notifications.show('Un centro de costo de tipo PROYECTO requiere un proyecto asociado.', 'info');
      return;
    }

    this.guardando = true;
    this.cp.guardarCentroCosto(this.form).subscribe({
      next: () => {
        this.guardando = false;
        this.notifications.show('Centro de costo guardado correctamente.', 'success');
        this.cerrarModal();
        this.load();
      },
      error: err => {
        this.guardando = false;
        this.notifications.show(err?.error?.message || 'No se pudo guardar el centro de costo.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  onAccion(event: Event, row: any): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    select.value = '';
    if (value === 'edit') this.edit(row);
    if (value === 'estado') this.cambiarEstado(row);
  }

  cambiarEstado(row: any): void {
    const activar = !row.activo;
    const verbo = activar ? 'activar' : 'desactivar';
    if (!confirm(`¿Deseas ${verbo} el centro de costo ${row.codigo}?`)) return;

    this.cp.guardarCentroCosto({
      idCentroCosto: row.idCentroCosto,
      nombre: row.nombre,
      descripcion: row.descripcion,
      idProyecto: row.idProyecto,
      activo: activar
    }).subscribe({
      next: () => {
        this.notifications.show(`Centro de costo ${activar ? 'activado' : 'desactivado'}.`, 'success');
        this.load();
      },
      error: err => this.notifications.show(
        err?.error?.message || `No se pudo ${verbo} el centro de costo.`, 'error')
    });
  }
}
