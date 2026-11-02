import { normalizarBusqueda } from '../presentacion-presupuestos';
import { VersionesPresupuesto } from '../versiones/versiones-presupuesto';
import { FormularioPresupuesto } from '../formulario-presupuesto/formulario-presupuesto';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { extraerMensajeError } from '../../app/core/utils/api-error.util';
import { Presupuesto } from '../contratos-presupuestos';
import { CentroCostoResumen } from '../centros-costo/contratos-centros-costo';
import { MonedaPresupuestaria } from '../contratos-catalogos-presupuestarios';
import { PartidaCatalogo } from '../partidas/contratos-partidas';
import { RegistroPresupuestos } from '../registro-presupuestos';
import { CatalogoPartidas } from '../partidas/catalogo-partidas';
import { CatalogoCentrosCosto } from '../centros-costo/catalogo-centros-costo';
import { CatalogosPresupuestarios } from '../catalogos-presupuestarios';
import { DestroyRef, inject, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../app/core/services/notification.service';

@Component({
  standalone: true,
  selector: 'lista-presupuestos',
  imports: [CommonModule, FormsModule, FormularioPresupuesto, VersionesPresupuesto],
  templateUrl: './lista-presupuestos.html',
  styleUrls: ['../dialogos-presupuesto.css', './lista-presupuestos.css'],
})
export class ListaPresupuestos implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly catalogosPresupuestarios = inject(CatalogosPresupuestarios);
  private readonly catalogoCentrosCosto = inject(CatalogoCentrosCosto);
  private readonly catalogoPartidas = inject(CatalogoPartidas);
  private readonly registroPresupuestos = inject(RegistroPresupuestos);

  presupuestos: Presupuesto[] = [];
  centrosCosto: CentroCostoResumen[] = [];
  monedas: MonedaPresupuestaria[] = [];
  partidas: PartidaCatalogo[] = [];
  seleccionado: Presupuesto | null = null;
  loading = false;
  filtroActivo = 'true';
  filtroCentroCosto = '';
  filtroBusqueda = '';
  modalPresupuesto = false;
  presupuestoEditado: Presupuesto | null = null;
  private consultaListado?: Subscription;
  private readonly notifications = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.cargarCatalogos();
    this.load();
  }

  private readonly normalizar = normalizarBusqueda;

  get presupuestosFiltrados(): Presupuesto[] {
    const termino = this.normalizar(this.filtroBusqueda);
    if (!termino) return this.presupuestos ?? [];
    return (this.presupuestos ?? []).filter((row) =>
      this.normalizar([row.codigo, row.nombre, row.centroCosto].join(' ')).includes(termino),
    );
  }

  etiquetaEstado(estado: string | null): string {
    switch (estado) {
      case 'APROBADO':
        return 'Aprobado';
      case 'EN_ELABORACION':
        return 'En elaboración';
      case 'EN_REVISION':
        return 'En revisión';
      case 'SIN_VERSION_VIGENTE':
        return 'Sin versión vigente';
      case 'INCONSISTENTE':
        return 'Inconsistente';
      default:
        return estado || '—';
    }
  }

  cargarCatalogos(): void {
    this.catalogosPresupuestarios
      .monedas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.monedas = data;
          this.cdr.detectChanges();
        },
        error: () =>
          this.notifications.show('No se pudieron cargar los catálogos del módulo.', 'error'),
      });

    this.catalogoCentrosCosto
      .centrosCosto(true, null, null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.centrosCosto = rows ?? [];
          this.cdr.detectChanges();
        },
        error: () =>
          this.notifications.show('No se pudieron cargar los centros de costo.', 'error'),
      });

    this.catalogoPartidas
      .partidas({ activo: true, esHoja: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.partidas = rows ?? [];
          this.cdr.detectChanges();
        },
        error: () => this.notifications.show('No se pudieron cargar las partidas.', 'error'),
      });
  }

  load(): void {
    this.loading = true;
    const activo = this.filtroActivo === '' ? null : this.filtroActivo === 'true';
    const centro = this.filtroCentroCosto === '' ? null : Number(this.filtroCentroCosto);

    this.consultaListado?.unsubscribe();
    this.consultaListado = this.registroPresupuestos
      .presupuestos(activo, centro, null, null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.presupuestos = rows ?? [];
          this.loading = false;
          if (this.seleccionado) {
            const vigente = this.presupuestos.find(
              (p) => p.idPresupuesto === this.seleccionado?.idPresupuesto,
            );
            this.seleccionado = vigente ?? null;
            if (!this.seleccionado) this.limpiarSeleccion();
          }
          this.cdr.detectChanges();
        },
        error: (err: unknown) => {
          this.loading = false;
          this.notifications.show(
            extraerMensajeError(err, 'No se pudieron cargar los presupuestos.'),
            'error',
          );
          this.cdr.detectChanges();
        },
      });
  }

  protected recargarPartidas(): void {
    this.catalogoPartidas
      .partidas({ activo: true, esHoja: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.partidas = rows ?? [];
          this.cdr.detectChanges();
        },
        error: (error: unknown) =>
          this.notifications.show(
            extraerMensajeError(error, 'No se pudieron actualizar las partidas.'),
            'error',
          ),
      });
  }

  abrirModalNuevo(): void {
    this.presupuestoEditado = null;
    this.modalPresupuesto = true;
  }
  editarPresupuesto(row: Presupuesto): void {
    this.presupuestoEditado = row;
    this.modalPresupuesto = true;
  }

  limpiarSeleccion(): void {
    this.seleccionado = null;
  }
  seleccionar(row: Presupuesto): void {
    this.seleccionado = row;
  }
}
