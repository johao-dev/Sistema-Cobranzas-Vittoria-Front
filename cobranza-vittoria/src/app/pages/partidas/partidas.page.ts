import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ControlPresupuestarioService } from '../../core/services/control-presupuestario.service';
import { NotificationService } from '../../core/services/notification.service';
import { ImportModalComponent } from '../../shared/components/import-modal/import-modal.component';

@Component({
  standalone: true,
  selector: 'app-partidas-page',
  imports: [CommonModule, FormsModule, ImportModalComponent],
  templateUrl: './partidas.page.html',
  styleUrl: './partidas.page.css'
})
export class PartidasPage implements OnInit {
  rows: any[] = [];
  tipos: any[] = [];
  secciones: any[] = [];

  loading = false;
  modalOpen = false;
  importOpen = false;
  guardando = false;

  filtroActivo = 'true';
  filtroTipo = '';
  filtroNivel = '';
  /** '' todas · 'sin' sin sección · id de sección. */
  filtroSeccion = '';
  filtroBusqueda = '';

  form: any = this.formVacio();

  constructor(
    private cp: ControlPresupuestarioService,
    private notifications: NotificationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.cargarCatalogos();
    this.load();
  }

  formVacio() {
    return {
      idCatalogoPartida: null,
      codigo: '',
      nombre: '',
      idTipoPartida: '',
      idPartidaPadre: '',
      descripcion: '',
      idSeccionGasto: '',
      activo: true,
      esHoja: true
    };
  }

  get esEdicion(): boolean {
    return !!this.form.idCatalogoPartida;
  }

  /** Solo una partida sin hijas puede pertenecer a una sección de gasto. */
  get seccionHabilitada(): boolean {
    return !!this.form.esHoja;
  }

  /**
   * Una partida solo puede ser padre si todavía no tiene montos asignados en
   * ninguna versión. La validación definitiva la hace el procedimiento
   * almacenado; aquí solo se excluye la partida en edición y sus descendientes
   * directos para evitar el ciclo más obvio.
   */
  get partidasPadreDisponibles(): any[] {
    const actual = this.form.idCatalogoPartida;
    // Una partida con sección de gasto no puede tener hijas: no se ofrece como padre.
    return (this.rows ?? []).filter(r => r.activo && r.idCatalogoPartida !== actual && !r.idSeccionGasto);
  }

  private normalizar(valor: any): string {
    return (valor ?? '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  get rowsFiltradas(): any[] {
    let base = this.rows ?? [];
    if (this.filtroNivel !== '') {
      base = base.filter(r => String(r.nivel) === this.filtroNivel);
    }
    if (this.filtroSeccion === 'sin') {
      base = base.filter(r => !r.idSeccionGasto);
    } else if (this.filtroSeccion !== '') {
      base = base.filter(r => String(r.idSeccionGasto) === this.filtroSeccion);
    }
    const termino = this.normalizar(this.filtroBusqueda);
    if (!termino) return base;
    return base.filter(row =>
      this.normalizar([row.codigo, row.nombre, row.nombrePartidaPadre, row.nombreTipoPartida,
        row.nombreSeccionGasto].join(' '))
        .includes(termino));
  }

  get nivelesDisponibles(): number[] {
    const niveles = new Set<number>((this.rows ?? []).map(r => Number(r.nivel)).filter(n => !isNaN(n)));
    return Array.from(niveles).sort((a, b) => a - b);
  }

  cargarCatalogos(): void {
    this.cp.catalogos().subscribe({
      next: data => {
        this.tipos = data?.tiposPartida ?? [];
        this.secciones = data?.seccionesGasto ?? [];
        this.cdr.detectChanges();
      },
      error: () => this.notifications.show('No se pudieron cargar los catálogos del módulo.', 'error')
    });
  }

  load(): void {
    this.loading = true;
    const activo = this.filtroActivo === '' ? null : this.filtroActivo === 'true';
    const tipo = this.filtroTipo === '' ? null : Number(this.filtroTipo);

    this.cp.partidas({ activo, idTipoPartida: tipo }).subscribe({
      next: rows => {
        this.rows = rows ?? [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.loading = false;
        this.notifications.show(err?.error?.message || 'No se pudieron cargar las partidas.', 'error');
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
      idCatalogoPartida: row.idCatalogoPartida,
      codigo: row.codigo ?? '',
      nombre: row.nombre ?? '',
      idTipoPartida: row.idTipoPartida ?? '',
      idPartidaPadre: row.idPartidaPadre ?? '',
      descripcion: row.descripcion ?? '',
      idSeccionGasto: row.idSeccionGasto ?? '',
      activo: row.activo ?? true,
      esHoja: row.esHoja
    };
    this.modalOpen = true;
    this.cdr.detectChanges();
  }

  save(): void {
    if (!this.esEdicion && !String(this.form.codigo ?? '').trim()) {
      this.notifications.show('Ingresa el código de la partida.', 'info');
      return;
    }
    if (!String(this.form.nombre ?? '').trim()) {
      this.notifications.show('Ingresa el nombre de la partida.', 'info');
      return;
    }
    if (!this.form.idTipoPartida) {
      this.notifications.show('Selecciona el tipo de partida.', 'info');
      return;
    }

    this.guardando = true;
    const dto = { ...this.form, idSeccionGasto: this.seccionHabilitada ? this.form.idSeccionGasto : null };
    this.cp.guardarPartida(dto).subscribe({
      next: () => {
        this.guardando = false;
        this.notifications.show('Partida guardada correctamente.', 'success');
        this.cerrarModal();
        this.load();
      },
      error: err => {
        this.guardando = false;
        this.notifications.show(err?.error?.message || 'No se pudo guardar la partida.', 'error');
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
    if (!confirm(`¿Deseas ${verbo} la partida ${row.codigo}?`)) return;

    this.cp.guardarPartida({
      idCatalogoPartida: row.idCatalogoPartida,
      nombre: row.nombre,
      idTipoPartida: row.idTipoPartida,
      idPartidaPadre: row.idPartidaPadre,
      descripcion: row.descripcion,
      // Se reenvía la sección: el PUT reemplaza la partida completa.
      idSeccionGasto: row.idSeccionGasto,
      activo: activar
    }).subscribe({
      next: () => {
        this.notifications.show(`Partida ${activar ? 'activada' : 'desactivada'}.`, 'success');
        this.load();
      },
      error: err => this.notifications.show(
        err?.error?.message || `No se pudo ${verbo} la partida.`, 'error')
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

  sangria(nivel: number): string {
    const n = Number(nivel) || 1;
    return `${(n - 1) * 18}px`;
  }
}
