import { normalizarBusqueda } from '../presentacion-presupuestos';
import { FormularioCentroCosto } from './formulario-centro-costo';
import { finalize, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { extraerMensajeError } from '../../shared/errores-api/mensajes-error-api';
import { CentroCostoResumen } from './contratos-centros-costo';
import { TipoCentroCosto } from '../contratos-catalogos-presupuestarios';
import { Proyecto } from '../../catalogos/proyectos/contratos-proyectos';
import { CatalogoCentrosCosto } from './catalogo-centros-costo';
import { CatalogosPresupuestarios } from '../catalogos-presupuestarios';
import { DestroyRef, inject, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogoProyectos } from '../../catalogos/proyectos/catalogo-proyectos';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { ModalImportacion } from '../../shared/importacion/modal-importacion/modal-importacion';

@Component({
  standalone: true,
  selector: 'lista-centros-costo',
  imports: [FormularioCentroCosto, FormsModule, ModalImportacion],
  templateUrl: './lista-centros-costo.html',
  styleUrls: ['../dialogos-presupuesto.css', './lista-centros-costo.css'],
})
export class ListaCentrosCosto implements OnInit {
  private consultaLoad?: Subscription;

  private readonly destroyRef = inject(DestroyRef);
  private readonly catalogosPresupuestarios = inject(CatalogosPresupuestarios);
  private readonly catalogoCentrosCosto = inject(CatalogoCentrosCosto);

  rows: CentroCostoResumen[] = [];
  tipos: TipoCentroCosto[] = [];
  proyectos: Proyecto[] = [];

  loading = false;
  modalOpen = false;
  editado: CentroCostoResumen | null = null;
  guardando = false;
  importOpen = false;

  filtroActivo = 'true';
  filtroTipo = '';
  filtroBusqueda = '';

  private readonly proyectosApi = inject(CatalogoProyectos);
  private readonly notifications = inject(Notificaciones);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.consultaLoad?.unsubscribe());
    this.cargarCatalogos();
    this.load();
  }

  private readonly normalizar = normalizarBusqueda;

  get rowsFiltradas(): CentroCostoResumen[] {
    const termino = this.normalizar(this.filtroBusqueda);
    if (!termino) return this.rows ?? [];
    return (this.rows ?? []).filter((row) =>
      this.normalizar(
        [row.codigo, row.nombre, row.nombreProyecto, row.nombreTipoCentroCosto].join(' '),
      ).includes(termino),
    );
  }

  cargarCatalogos(): void {
    this.catalogosPresupuestarios
      .catalogos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.tipos = data?.tiposCentroCosto ?? [];
          this.cdr.detectChanges();
        },
        error: () =>
          this.notifications.show('No se pudieron cargar los catálogos del módulo.', 'error'),
      });

    this.proyectosApi
      .proyectos(true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.proyectos = rows ?? [];
          this.cdr.detectChanges();
        },
        error: () => this.notifications.show('No se pudieron cargar los proyectos.', 'error'),
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

  get proyectosDisponibles(): Proyecto[] {
    const usados = new Set(this.rows.map((r) => r.idProyecto).filter(Boolean));
    return this.proyectos.filter((p) => p.activo !== false && !usados.has(p.idProyecto));
  }

  load(): void {
    this.consultaLoad?.unsubscribe();
    this.loading = true;
    const activo = this.filtroActivo === '' ? null : this.filtroActivo === 'true';
    const tipo = this.filtroTipo === '' ? null : Number(this.filtroTipo);

    this.consultaLoad = this.catalogoCentrosCosto
      .centrosCosto(activo, tipo, null)
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
            extraerMensajeError(err, 'No se pudieron cargar los centros de costo.'),
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

  onAccion(event: Event, row: CentroCostoResumen): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const value = select.value;
    select.value = '';
    if (value === 'edit') this.edit(row);
    if (value === 'estado') this.cambiarEstado(row);
  }

  cambiarEstado(row: CentroCostoResumen): void {
    if (this.guardando) return;
    const activar = !row.activo;
    const verbo = activar ? 'activar' : 'desactivar';
    if (!confirm(`¿Deseas ${verbo} el centro de costo ${row.codigo}?`)) return;

    this.guardando = true;
    this.catalogoCentrosCosto
      .guardarCentroCosto({
        idCentroCosto: row.idCentroCosto,
        nombre: row.nombre,
        descripcion: row.descripcion,
        idProyecto: row.idProyecto,
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
          this.notifications.show(
            `Centro de costo ${activar ? 'activado' : 'desactivado'}.`,
            'success',
          );
          this.load();
        },
        error: (err: unknown) =>
          this.notifications.show(
            extraerMensajeError(err, `No se pudo ${verbo} el centro de costo.`),
            'error',
          ),
      });
  }
  edit(row: CentroCostoResumen): void {
    this.editado = row;
    this.modalOpen = true;
  }
}
