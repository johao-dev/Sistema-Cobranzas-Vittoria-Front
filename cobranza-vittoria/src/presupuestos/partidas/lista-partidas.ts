import { normalizarBusqueda } from '../presentacion-presupuestos';
import { FormularioPartida } from './formulario-partida';
import { finalize, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { extraerMensajeError } from '../../app/core/utils/api-error.util';
import { PartidaCatalogo } from './contratos-partidas';
import { TipoPartida } from '../contratos-catalogos-presupuestarios';
import { CatalogoPartidas } from './catalogo-partidas';
import { CatalogosPresupuestarios } from '../catalogos-presupuestarios';
import { DestroyRef, inject, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../app/core/services/notification.service';
import { ImportModalComponent } from '../../app/shared/components/import-modal/import-modal.component';

@Component({
  standalone: true,
  selector: 'lista-partidas',
  imports: [FormularioPartida, FormsModule, ImportModalComponent],
  templateUrl: './lista-partidas.html',
  styleUrls: ['../dialogos-presupuesto.css', './lista-partidas.css'],
})
export class ListaPartidas implements OnInit {
  private consultaLoad?: Subscription;

  private readonly destroyRef = inject(DestroyRef);
  private readonly catalogosPresupuestarios = inject(CatalogosPresupuestarios);
  private readonly catalogoPartidas = inject(CatalogoPartidas);

  rows: PartidaCatalogo[] = [];
  tipos: TipoPartida[] = [];

  loading = false;
  modalOpen = false;
  editado: PartidaCatalogo | null = null;
  importOpen = false;
  guardando = false;

  filtroActivo = 'true';
  filtroTipo = '';
  filtroNivel = '';
  filtroBusqueda = '';

  private readonly notifications = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.consultaLoad?.unsubscribe());
    this.cargarCatalogos();
    this.load();
  }

  private readonly normalizar = normalizarBusqueda;

  get rowsFiltradas(): PartidaCatalogo[] {
    let base = this.rows ?? [];
    if (this.filtroNivel !== '') {
      base = base.filter((r) => String(r.nivel) === this.filtroNivel);
    }
    const termino = this.normalizar(this.filtroBusqueda);
    if (!termino) return base;
    return base.filter((row) =>
      this.normalizar(
        [row.codigo, row.nombre, row.nombrePartidaPadre, row.nombreTipoPartida].join(' '),
      ).includes(termino),
    );
  }

  get nivelesDisponibles(): number[] {
    const niveles = new Set<number>(
      (this.rows ?? []).map((r) => Number(r.nivel)).filter((n) => !isNaN(n)),
    );
    return Array.from(niveles).sort((a, b) => a - b);
  }

  cargarCatalogos(): void {
    this.catalogosPresupuestarios
      .catalogos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.tipos = data?.tiposPartida ?? [];
          this.cdr.detectChanges();
        },
        error: () =>
          this.notifications.show('No se pudieron cargar los catálogos del módulo.', 'error'),
      });
  }

  load(): void {
    this.consultaLoad?.unsubscribe();
    this.loading = true;
    const activo = this.filtroActivo === '' ? null : this.filtroActivo === 'true';
    const tipo = this.filtroTipo === '' ? null : Number(this.filtroTipo);

    this.consultaLoad = this.catalogoPartidas
      .partidas({ activo, idTipoPartida: tipo })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.rows = rows ?? [];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err: unknown) => {
          this.loading = false;
          this.notifications.show(
            extraerMensajeError(err, 'No se pudieron cargar las partidas.'),
            'error',
          );
          this.cdr.detectChanges();
        },
      });
  }

  abrirModalNuevo(): void {
    this.editado = null;
    this.modalOpen = true;
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.modalOpen = false;
    this.cdr.detectChanges();
  }

  onAccion(event: Event, row: PartidaCatalogo): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const value = select.value;
    select.value = '';
    if (value === 'edit') this.edit(row);
    if (value === 'estado') this.cambiarEstado(row);
  }

  cambiarEstado(row: PartidaCatalogo): void {
    if (this.guardando) return;
    const activar = !row.activo;
    const verbo = activar ? 'activar' : 'desactivar';
    if (!confirm(`¿Deseas ${verbo} la partida ${row.codigo}?`)) return;

    this.guardando = true;
    this.catalogoPartidas
      .guardarPartida({
        idCatalogoPartida: row.idCatalogoPartida,
        nombre: row.nombre,
        idTipoPartida: row.idTipoPartida,
        idPartidaPadre: row.idPartidaPadre,
        descripcion: row.descripcion,
        activo: activar,
      })
      .pipe(
        finalize(() => {
          this.guardando = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notifications.show(`Partida ${activar ? 'activada' : 'desactivada'}.`, 'success');
          this.load();
        },
        error: (err: unknown) =>
          this.notifications.show(
            extraerMensajeError(err, `No se pudo ${verbo} la partida.`),
            'error',
          ),
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
  edit(row: PartidaCatalogo): void {
    this.editado = row;
    this.modalOpen = true;
  }
}
