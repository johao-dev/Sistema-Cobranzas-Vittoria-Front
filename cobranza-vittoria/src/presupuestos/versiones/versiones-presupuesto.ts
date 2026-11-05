import {
  computed,
  signal,
  DestroyRef,
  inject,
  Component,
  OnDestroy,
  OnChanges,
  input,
  output,
  SimpleChanges,
} from '@angular/core';
import { Subject, takeUntil, finalize, Subscription } from 'rxjs';
import {
  ContextoMovimientos,
  HistorialPresupuestario,
} from '../movimientos/historial-presupuestario';
import { CargaMontosPresupuesto } from '../carga-montos/carga-montos-presupuesto';
import { DialogoModal } from '../../shared/dialogos/dialogo-modal';
import { ImportacionPresupuesto } from '../importacion/importacion-presupuesto';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { extraerMensajeError } from '../../shared/errores-api/mensajes-error-api';
import {
  Presupuesto,
  VersionPresupuesto,
  DetallePresupuesto,
  ResultadoEstructuraPresupuesto,
} from '../contratos-presupuestos';
import { BorradorVersion, BorradorDetalle, BorradorAjuste } from '../borradores-presupuesto';
import { PartidaCatalogo } from '../partidas/contratos-partidas';
import { RegistroPresupuestos } from '../registro-presupuestos';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NodoArbol } from '../arbol/contratos-arbol-presupuestario';
import { Notificaciones } from '../../shared/notificaciones/notificaciones';
import { AccionPartida, ArbolPresupuestario } from '../arbol/arbol-presupuestario';

@Component({
  standalone: true,
  selector: 'versiones-presupuesto',
  imports: [
    HistorialPresupuestario,
    CargaMontosPresupuesto,
    DialogoModal,
    CommonModule,
    FormsModule,
    ArbolPresupuestario,
    ImportacionPresupuesto,
  ],
  templateUrl: './versiones-presupuesto.html',
  styleUrls: ['../dialogos-presupuesto.css', './versiones-presupuesto.css'],
})
export class VersionesPresupuesto implements OnChanges, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly registroPresupuestos = inject(RegistroPresupuestos);
  private readonly notifications = inject(Notificaciones);

  readonly presupuesto = input.required<Presupuesto>();
  readonly partidas = input.required<PartidaCatalogo[]>();
  readonly actualizado = output<void>();
  readonly partidasActualizadas = output<void>();
  readonly cerrar = output<void>();
  private readonly cambioContexto = new Subject<void>();
  private consultaVersiones?: Subscription;
  private consultaDetalles?: Subscription;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['presupuesto']) return;
    const anterior: unknown = changes['presupuesto'].previousValue;
    if (
      typeof anterior === 'object' &&
      anterior !== null &&
      'idPresupuesto' in anterior &&
      anterior.idPresupuesto === this.presupuesto().idPresupuesto
    )
      return;
    this.cambioContexto.next();
    this.guardando.set(false);
    this.cargandoDetalles.set(false);
    this.consultaDetalles?.unsubscribe();
    this.cerrarModales();
    this.versionSeleccionada.set(null);
    this.versiones.set([]);
    this.detalles.set([]);
    this.observacionesPartidas.set(new Map());
    this.cargarVersiones();
  }
  ngOnDestroy(): void {
    this.consultaDetalles?.unsubscribe();
    this.consultaVersiones?.unsubscribe();
  }

  readonly versiones = signal<VersionPresupuesto[]>([]);
  readonly detalles = signal<DetallePresupuesto[]>([]);

  readonly versionSeleccionada = signal<VersionPresupuesto | null>(null);
  readonly detalleSeleccionado = signal<DetallePresupuesto | null>(null);

  readonly cargandoVersiones = signal(false);
  readonly cargandoDetalles = signal(false);
  readonly guardando = signal(false);

  readonly modalVersion = signal(false);
  readonly modalAnular = signal(false);
  readonly motivoAnulacion = signal('');
  readonly modalDetalle = signal(false);
  readonly modalMovimientos = signal(false);
  readonly contextoMovimientos = signal<ContextoMovimientos | null>(null);
  readonly modalAjuste = signal(false);
  readonly modalCarga = signal(false);
  readonly modalImportar = signal(false);
  readonly modalEstructura = signal(false);

  readonly observacionesPartidas = signal<ReadonlyMap<number, string>>(new Map());
  readonly recargaArbol = signal(0);
  /** Resultado de la última importación de estructura, visible sobre el árbol. */
  readonly resumenEstructura = signal<ResultadoEstructuraPresupuesto | null>(null);

  formVersion: BorradorVersion = { descripcion: '', motivoCambio: '' };
  formDetalle: BorradorDetalle = this.formDetalleVacio();
  formAjuste: BorradorAjuste = this.formAjusteVacio();

  formDetalleVacio(): BorradorDetalle {
    return {
      idPresupuestoDetalle: null,
      idCatalogoPartida: '',
      montoPresupuestado: 0,
      observacion: '',
    };
  }

  formAjusteVacio(): BorradorAjuste {
    return {
      afectacion: 'EJECUCION',
      direccion: 'DECREMENTO',
      monto: 0,
      observacion: '',
      fecha: '',
    };
  }

  get esEdicionDetalle(): boolean {
    return !!this.formDetalle.idPresupuestoDetalle;
  }

  /** Solo una versión en BORRADOR admite cambios de montos. */
  readonly versionEditable = computed(() => this.versionSeleccionada()?.estado === 'BORRADOR');

  readonly versionAprobable = computed(() => this.versionEditable() && this.detalles().length > 0);

  /** Las partidas agrupadoras no reciben monto; solo se presupuestan las hojas. */
  get partidasAsignables(): PartidaCatalogo[] {
    const yaAsignadas = new Set(this.detalles().map((d) => d.idCatalogoPartida));
    return (this.partidas() ?? []).filter(
      (p) =>
        p.activo &&
        p.esHoja &&
        (p.idCatalogoPartida === this.formDetalle.idCatalogoPartida ||
          !yaAsignadas.has(p.idCatalogoPartida)),
    );
  }

  readonly simbolo = computed(
    () => this.presupuesto().simboloMoneda || this.presupuesto().moneda || '',
  );

  cargarVersiones(): void {
    if (!this.presupuesto()) return;
    this.cargandoVersiones.set(true);

    this.consultaVersiones?.unsubscribe();
    this.consultaVersiones = this.registroPresupuestos
      .versiones(this.presupuesto().idPresupuesto)
      .pipe(takeUntil(this.cambioContexto), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.versiones.set(rows ?? []);
          this.cargandoVersiones.set(false);
          // Prioriza el borrador en curso; si no hay, muestra la versión vigente.
          const preferida =
            this.versiones().find((v) => v.estado === 'BORRADOR') ??
            this.versiones().find((v) => v.estado === 'APROBADO') ??
            this.versiones()[0];
          if (preferida) this.seleccionarVersion(preferida);
        },
        error: (err: unknown) => {
          this.cargandoVersiones.set(false);
          this.notifications.show(
            extraerMensajeError(err, 'No se pudieron cargar las versiones.'),
            'error',
          );
        },
      });
  }

  seleccionarVersion(version: VersionPresupuesto): void {
    if (this.guardando()) return;
    this.cerrarModales();
    this.contextoMovimientos.set(null);
    this.versionSeleccionada.set(version);
    this.resumenEstructura.set(null);
    this.detalles.set([]);
    this.observacionesPartidas.set(new Map());
    this.cargarDetalles();
  }

  abrirModalVersion(): void {
    if (this.guardando()) return;
    if (!this.presupuesto()) return;
    this.formVersion = { descripcion: '', motivoCambio: '' };
    this.modalVersion.set(true);
  }

  crearVersion(): void {
    if (this.guardando()) return;
    if (!this.presupuesto()) return;
    if (!String(this.formVersion.motivoCambio ?? '').trim()) {
      this.notifications.show('Indica el motivo del cambio para dejar trazabilidad.', 'info');
      return;
    }

    this.guardando.set(true);
    this.registroPresupuestos
      .crearVersion(this.presupuesto().idPresupuesto, this.formVersion)
      .pipe(takeUntil(this.cambioContexto), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.modalVersion.set(false);
          this.notifications.show('Nueva versión creada en borrador.', 'success');
          this.cargarVersiones();
          this.actualizado.emit();
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.notifications.show(
            extraerMensajeError(err, 'No se pudo crear la versión.'),
            'error',
          );
        },
      });
  }

  aprobarVersion(): void {
    const versionSeleccionada = this.versionSeleccionada();
    if (this.guardando()) return;
    if (!this.presupuesto() || !versionSeleccionada) return;
    if (!this.versionAprobable()) return;
    const numero = versionSeleccionada.numeroVersion;
    if (
      !confirm(
        `¿Aprobar la versión ${numero}? A partir de la aprobación el presupuesto empieza a afectar saldos.`,
      )
    )
      return;

    this.guardando.set(true);
    this.registroPresupuestos
      .aprobarVersion(this.presupuesto().idPresupuesto, versionSeleccionada.idPresupuestoVersion)
      .pipe(
        finalize(() => {
          this.guardando.set(false);
        }),
        takeUntil(this.cambioContexto),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.notifications.show(`Versión ${numero} aprobada.`, 'success');
          this.cargarVersiones();
          this.actualizado.emit();
        },
        error: (err: unknown) =>
          this.notifications.show(
            extraerMensajeError(err, 'No se pudo aprobar la versión.'),
            'error',
          ),
      });
  }

  /** Anular un borrador no se revierte y exige el motivo, que queda en la versión. */
  anularVersion(): void {
    if (this.guardando()) return;
    if (!this.versionEditable()) return;
    this.motivoAnulacion.set('');
    this.modalAnular.set(true);
  }

  confirmarAnulacion(): void {
    const versionSeleccionada = this.versionSeleccionada();
    if (this.guardando()) return;
    if (!this.versionEditable() || !versionSeleccionada) return;
    const motivo = this.motivoAnulacion().trim();
    if (!motivo) {
      this.notifications.show('Indica el motivo de la anulación.', 'info');
      return;
    }
    const numero = versionSeleccionada.numeroVersion;
    this.guardando.set(true);
    this.registroPresupuestos
      .anularVersion(
        this.presupuesto().idPresupuesto,
        versionSeleccionada.idPresupuestoVersion,
        motivo,
      )
      .pipe(takeUntil(this.cambioContexto), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.modalAnular.set(false);
          this.notifications.show(`Versión ${numero} anulada.`, 'success');
          this.cargarVersiones();
          this.actualizado.emit();
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.notifications.show(
            extraerMensajeError(err, 'No se pudo anular la versión.'),
            'error',
          );
        },
      });
  }

  cargarDetalles(recargarArbol = false): void {
    const versionSeleccionada = this.versionSeleccionada();
    if (!this.presupuesto() || !versionSeleccionada) return;
    if (!versionSeleccionada) return;

    this.consultaDetalles?.unsubscribe();
    this.cargandoDetalles.set(true);
    if (recargarArbol) this.recargaArbol.update((valor) => valor + 1);

    this.consultaDetalles = this.registroPresupuestos
      .detalles(this.presupuesto().idPresupuesto, versionSeleccionada.idPresupuestoVersion)
      .pipe(takeUntil(this.cambioContexto), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.detalles.set(rows ?? []);
          this.observacionesPartidas.set(
            new Map(this.detalles().map((d) => [d.idCatalogoPartida, d.observacion ?? ''])),
          );
          this.cargandoDetalles.set(false);
        },
        error: (err: unknown) => {
          this.cargandoDetalles.set(false);
          this.notifications.show(
            extraerMensajeError(err, 'No se pudieron cargar los montos por partida.'),
            'error',
          );
        },
      });
  }

  abrirModalDetalle(detalle?: DetallePresupuesto): void {
    if (!this.versionEditable()) {
      this.notifications.show('Solo se pueden editar montos en una versión en borrador.', 'info');
      return;
    }
    this.formDetalle = detalle
      ? {
          idPresupuestoDetalle: detalle.idPresupuestoDetalle,
          idCatalogoPartida: detalle.idCatalogoPartida,
          montoPresupuestado: detalle.montoPresupuestado,
          observacion: detalle.observacion ?? '',
        }
      : this.formDetalleVacio();
    this.modalDetalle.set(true);
  }

  guardarDetalle(): void {
    const versionSeleccionada = this.versionSeleccionada();
    if (!this.presupuesto() || !versionSeleccionada) return;
    if (!versionSeleccionada || !this.versionEditable() || this.guardando()) return;
    if (!this.esEdicionDetalle && !this.formDetalle.idCatalogoPartida) {
      this.notifications.show('Selecciona la partida a presupuestar.', 'info');
      return;
    }
    const monto = Number(this.formDetalle.montoPresupuestado ?? 0);
    if (!Number.isFinite(monto) || this.formDetalle.montoPresupuestado === null || monto < 0) {
      this.notifications.show('El monto presupuestado no puede ser negativo.', 'info');
      return;
    }

    this.guardando.set(true);
    const peticion = this.esEdicionDetalle
      ? this.registroPresupuestos.actualizarDetalle(
          this.presupuesto().idPresupuesto,
          versionSeleccionada.idPresupuestoVersion,
          Number(this.formDetalle.idPresupuestoDetalle),
          this.formDetalle,
        )
      : this.registroPresupuestos.agregarDetalle(
          this.presupuesto().idPresupuesto,
          versionSeleccionada.idPresupuestoVersion,
          this.formDetalle,
        );

    peticion.pipe(takeUntil(this.cambioContexto), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalDetalle.set(false);
        this.notifications.show('Monto guardado correctamente.', 'success');
        this.cargarDetalles(true);
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.notifications.show(extraerMensajeError(err, 'No se pudo guardar el monto.'), 'error');
      },
    });
  }

  eliminarDetalle(detalle: DetallePresupuesto): void {
    const versionSeleccionada = this.versionSeleccionada();
    if (!this.presupuesto() || !versionSeleccionada) return;
    if (!this.versionEditable()) {
      this.notifications.show('Solo se pueden quitar partidas en una versión en borrador.', 'info');
      return;
    }
    if (this.guardando()) return;
    if (!confirm(`¿Quitar la partida ${detalle.codigo} de esta versión?`)) return;

    this.guardando.set(true);
    this.registroPresupuestos
      .eliminarDetalle(
        this.presupuesto().idPresupuesto,
        versionSeleccionada.idPresupuestoVersion,
        detalle.idPresupuestoDetalle,
      )
      .pipe(takeUntil(this.cambioContexto), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.notifications.show('Partida retirada de la versión.', 'success');
          this.cargarDetalles(true);
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.notifications.show(
            extraerMensajeError(err, 'No se pudo quitar la partida.'),
            'error',
          );
        },
      });
  }

  verMovimientos(detalle: DetallePresupuesto): void {
    const versionSeleccionada = this.versionSeleccionada();
    if (!versionSeleccionada) return;
    this.detalleSeleccionado.set(detalle);
    this.contextoMovimientos.set({
      modo: 'individual',
      idPresupuesto: this.presupuesto().idPresupuesto,
      idVersion: versionSeleccionada.idPresupuestoVersion,
      idDetalle: detalle.idPresupuestoDetalle,
      codigo: detalle.codigo,
      nombre: detalle.nombre,
    });
    this.modalMovimientos.set(true);
  }

  abrirModalAjuste(detalle: DetallePresupuesto): void {
    this.detalleSeleccionado.set(detalle);
    this.formAjuste = this.formAjusteVacio();
    this.modalAjuste.set(true);
  }

  registrarAjuste(): void {
    const versionSeleccionada = this.versionSeleccionada();
    const detalleSeleccionado = this.detalleSeleccionado();
    if (!this.presupuesto() || !versionSeleccionada) return;
    if (!detalleSeleccionado || this.guardando()) return;
    const monto = Number(this.formAjuste.monto ?? 0);
    if (!Number.isFinite(monto) || monto <= 0) {
      this.notifications.show('El monto del ajuste debe ser mayor a cero.', 'info');
      return;
    }
    if (!String(this.formAjuste.observacion ?? '').trim()) {
      this.notifications.show('Un ajuste requiere una observación que lo justifique.', 'info');
      return;
    }

    this.guardando.set(true);
    this.registroPresupuestos
      .registrarAjuste(
        this.presupuesto().idPresupuesto,
        versionSeleccionada.idPresupuestoVersion,
        detalleSeleccionado.idPresupuestoDetalle,
        this.formAjuste,
      )
      .pipe(takeUntil(this.cambioContexto), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.modalAjuste.set(false);
          this.notifications.show('Ajuste registrado en el historial.', 'success');
          this.cargarDetalles(true);
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.notifications.show(
            extraerMensajeError(err, 'No se pudo registrar el ajuste.'),
            'error',
          );
        },
      });
  }

  cerrarModales(): void {
    if (this.guardando()) return;

    this.modalVersion.set(false);
    this.modalAnular.set(false);
    this.modalDetalle.set(false);
    this.modalMovimientos.set(false);
    this.modalAjuste.set(false);
    this.modalCarga.set(false);
    this.modalImportar.set(false);
    this.modalEstructura.set(false);
  }

  /**
   * Abre la grilla con todas las partidas hoja activas. Las que ya están en la
   * versión traen su monto; las demás empiezan en 0 ("si no aplica, se deja en 0").
   */

  /** Muestra el encabezado de grupo solo en la primera fila visible de cada padre. */

  /** Excel jerárquico de las áreas: crea las partidas que falten y carga los montos de las hojas. */

  /** La importación de estructura puede crear partidas: se refresca el catálogo de hojas. */

  accionarPartida(evento: AccionPartida): void {
    if (this.cargandoDetalles() || this.guardando()) return;

    const detalle = this.detalles().find((d) =>
      evento.nodo.idPresupuestoDetalle != null
        ? d.idPresupuestoDetalle === evento.nodo.idPresupuestoDetalle
        : d.idCatalogoPartida === evento.nodo.idCatalogoPartida,
    );
    if (!detalle) {
      this.notifications.show('No se encontró el detalle de esta partida en la versión.', 'info');
      return;
    }

    switch (evento.accion) {
      case 'editar':
        this.abrirModalDetalle(detalle);
        break;
      case 'historial':
        this.verMovimientos(detalle);
        break;
      case 'ajustar':
        this.abrirModalAjuste(detalle);
        break;
      case 'quitar':
        this.eliminarDetalle(detalle);
        break;
    }
  }

  /** Hoja del árbol de la versión: se abre el historial de su detalle. */
  verMovimientosNodo(nodo: NodoArbol): void {
    this.accionarPartida({ accion: 'historial', nodo });
  }

  /** errores[].fila cuenta solo filas de datos; en la hoja de Excel se suma el encabezado. */

  abrirImportar(): void {
    if (this.versionEditable()) this.modalImportar.set(true);
  }
  abrirImportarEstructura(): void {
    if (this.versionEditable()) this.modalEstructura.set(true);
  }
  onImportado(resultado: ResultadoEstructuraPresupuesto | null): void {
    this.resumenEstructura.set(resultado);
    this.cargarDetalles(true);
    if (resultado) {
      this.modalEstructura.set(false);
      this.partidasActualizadas.emit();
    }
  }

  abrirCargaCompleta(): void {
    if (this.versionEditable()) this.modalCarga.set(true);
  }
}
