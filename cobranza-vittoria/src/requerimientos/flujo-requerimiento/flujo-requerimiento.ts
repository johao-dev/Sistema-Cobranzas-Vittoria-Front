import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../../app/core/services/notification.service';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { RegistroRequerimientos } from '../registro-requerimientos';
import { mensajeRequerimiento } from '../mensaje-requerimiento';
import { ResultadoValidacionAlmacen } from '../contratos-requerimientos';
import { Subject } from 'rxjs';
import { ConsultaRequerimientos } from '../consulta-requerimientos/consulta-requerimientos';
import { BorradorRequerimiento } from '../borrador-requerimiento/borrador-requerimiento';
import { EdicionItemRequerimiento } from '../edicion-item-requerimiento/edicion-item-requerimiento';
import { ItemsAlmacenRequerimiento } from '../items-almacen-requerimiento/items-almacen-requerimiento';

export type AccionFlujo = 'enviar' | 'validar-almacen' | 'aprobar' | 'rechazar' | 'enviar-compras';

@Injectable()
export class FlujoRequerimiento {
  private readonly requerimientos = inject(RegistroRequerimientos);
  readonly auth = inject(SesionUsuario);
  private readonly notifyService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly consulta = inject(ConsultaRequerimientos);
  private readonly borrador = inject(BorradorRequerimiento);
  private readonly editor = inject(EdicionItemRequerimiento);
  private readonly almacen = inject(ItemsAlmacenRequerimiento);

  readonly accionModalOpen = signal(false);
  readonly accionActual = signal<AccionFlujo | null>(null);
  readonly accionObservacion = signal('');
  readonly accionResultado = signal<ResultadoValidacionAlmacen>('Conforme');
  readonly procesandoAccion = signal(false);

  private readonly alCompletar = new Subject<number>();

  readonly completada = this.alCompletar.asObservable();

  get puedeCrear(): boolean {
    return this.auth.hasPermission('requerimientos.crear');
  }

  get puedeEnviar(): boolean {
    return this.estadoDetalle === 'Registrado' && this.auth.hasPermission('requerimientos.enviar');
  }

  get puedeProcesarStock(): boolean {
    return (
      this.estadoDetalle === 'EnviadoAlmacen' &&
      this.auth.hasPermission('requerimientos.procesar_stock')
    );
  }

  get puedeAprobar(): boolean {
    return (
      this.estadoDetalle === 'ValidadoAlmacen' && this.auth.hasPermission('requerimientos.aprobar')
    );
  }

  get puedeRechazar(): boolean {
    return (
      ['ValidadoAlmacen', 'AprobadoCoordinador'].includes(this.estadoDetalle) &&
      this.auth.hasPermission('requerimientos.rechazar')
    );
  }

  get puedeEnviarCompras(): boolean {
    return (
      this.estadoDetalle === 'AprobadoCoordinador' &&
      this.auth.hasPermission('requerimientos.enviar_compras')
    );
  }

  get tieneAccionesFlujo(): boolean {
    return (
      this.puedeEnviar ||
      this.puedeProcesarStock ||
      this.puedeAprobar ||
      this.puedeRechazar ||
      this.puedeEnviarCompras
    );
  }

  get accionTitulo(): string {
    const titulos: Record<AccionFlujo, string> = {
      enviar: 'Enviar a almacén',
      'validar-almacen': 'Procesar stock',
      aprobar: 'Aprobar requerimiento',
      rechazar: 'Rechazar requerimiento',
      'enviar-compras': 'Enviar a compras',
    };

    const accion = this.accionActual();

    return accion ? titulos[accion] : 'Acción';
  }

  private get estadoDetalle(): string {
    return this.consulta.detalle()?.requerimiento?.estado ?? '';
  }

  abrirAccion(accion: AccionFlujo): void {
    if (this.procesandoAccion()) return;

    if (accion === 'validar-almacen' && !this.itemsListosParaValidar()) return;

    this.accionActual.set(accion);
    this.accionObservacion.set('');
    this.accionResultado.set('Conforme');
    this.accionModalOpen.set(true);
  }

  cerrarAccion(): void {
    if (this.procesandoAccion()) return;

    this.accionModalOpen.set(false);
    this.accionActual.set(null);
  }

  ejecutarAccion(): void {
    const id = this.consulta.detalle()?.requerimiento?.idRequerimiento;
    const accion = this.accionActual();

    if (!id || !accion || this.procesandoAccion()) return;

    if (accion === 'validar-almacen' && !this.itemsListosParaValidar()) return;

    const permitida =
      accion === 'enviar'
        ? this.puedeEnviar
        : accion === 'validar-almacen'
          ? this.puedeProcesarStock
          : accion === 'aprobar'
            ? this.puedeAprobar
            : accion === 'rechazar'
              ? this.puedeRechazar
              : this.puedeEnviarCompras;

    if (!permitida) {
      this.notifyService.show('La sesión o el estado actual no permiten esta acción.', 'error');
      return;
    }

    const observacion = this.accionObservacion().trim();

    if (
      (accion === 'rechazar' ||
        (accion === 'validar-almacen' && this.accionResultado() === 'Observado')) &&
      !observacion
    ) {
      this.notifyService.show('Debes ingresar una explicación para esta acción.', 'error');
      return;
    }

    // Cada transición usa su endpoint explícito; el PATCH genérico ya no forma parte del contrato.
    const request =
      accion === 'enviar'
        ? this.requerimientos.enviar(id, { observacion: observacion || null })
        : accion === 'validar-almacen'
          ? this.requerimientos.validarAlmacen(id, {
              resultado: this.accionResultado(),
              observacion: observacion || null,
            })
          : accion === 'aprobar'
            ? this.requerimientos.aprobar(id, { observacion: observacion || null })
            : accion === 'rechazar'
              ? this.requerimientos.rechazar(id, { observacion })
              : this.requerimientos.enviarCompras(id, { observacion: observacion || null });

    this.procesandoAccion.set(true);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.accionModalOpen.set(false);
        this.accionActual.set(null);

        this.notifyService.show('Acción realizada correctamente.', 'success');

        // Se vuelve a consultar el detalle porque los permisos visibles dependen del nuevo estado.
        this.alCompletar.next(id);
      },
      error: (error: unknown) => {
        this.procesandoAccion.set(false);

        this.notifyService.show(
          mensajeRequerimiento(error, 'No se pudo completar la acción.'),
          'error',
        );
      },
    });
  }

  private itemsListosParaValidar(): boolean {
    if (
      this.almacen.operacionItemPendiente ||
      this.almacen.detalleAlmacenDesactualizado() ||
      (this.borrador.gestionItemsAlmacen() && this.editor.modalEspecialidades())
    ) {
      this.notifyService.show(
        'Guarda o descarta la edición del ítem y espera la recarga del detalle antes de validar almacén.',
        'info',
      );
      return false;
    }

    return true;
  }
}
