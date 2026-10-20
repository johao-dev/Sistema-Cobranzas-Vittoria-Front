import {
  validarItemAlmacen,
  completarItemPersistido,
} from '../edicion-item-requerimiento/datos-item-requerimiento';
import { ItemRequerimiento } from '../contratos-formulario-requerimiento';
import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../../app/core/services/notification.service';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { RegistroRequerimientos } from '../registro-requerimientos';
import { mensajeRequerimiento } from '../mensaje-requerimiento';
import {
  RequerimientoDetalleItem,
  RequerimientoItemRequest,
  RequerimientoItemPatchRequest,
  RequerimientoItemResponse,
  RequerimientoGetResponse,
} from '../contratos-requerimientos';
import { Observable, finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Material } from '../../catalogos/materiales/contratos-materiales';
import { ReferenciasRequerimiento } from '../referencias-requerimiento/referencias-requerimiento';
import { ConsultaRequerimientos } from '../consulta-requerimientos/consulta-requerimientos';
import { BorradorRequerimiento } from '../borrador-requerimiento/borrador-requerimiento';
import { EdicionItemRequerimiento } from '../edicion-item-requerimiento/edicion-item-requerimiento';

@Injectable()
export class ItemsAlmacenRequerimiento {
  private readonly requerimientos = inject(RegistroRequerimientos);
  readonly auth = inject(SesionUsuario);
  private readonly notifyService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly consulta = inject(ConsultaRequerimientos);
  private readonly borrador = inject(BorradorRequerimiento);
  private readonly editor = inject(EdicionItemRequerimiento);
  private readonly referencias = inject(ReferenciasRequerimiento);

  readonly guardandoItem = signal(false);
  readonly recargandoItems = signal(false);
  readonly detalleAlmacenDesactualizado = signal(false);

  get operacionItemPendiente(): boolean {
    return this.guardandoItem() || this.recargandoItems();
  }

  get puedeGestionarItemsAlmacen(): boolean {
    return (
      (this.consulta.detalle()?.requerimiento.estado ?? '') === 'EnviadoAlmacen' &&
      !this.detalleAlmacenDesactualizado() &&
      this.auth.hasPermission('requerimientos.gestionar_items_almacen')
    );
  }

  guardarItemAlmacen(bloqueado: boolean): void {
    if (!this.puedeGestionarItemsAlmacen || this.operacionItemPendiente || bloqueado) return;

    const id: number | undefined = this.consulta.detalle()?.requerimiento.idRequerimiento;
    const cantidad: number | null = this.editor.modalItem().cantidad;
    const idMaterial = this.editor.modalItem().idMaterial;

    this.borrador.msg.set('');

    if (!id || !idMaterial) {
      this.borrador.msg.set('Debes seleccionar un material.');
      return;
    }

    const error = validarItemAlmacen(
      this.editor.original,
      this.editor.modalItem(),
      this.borrador.form().items,
    );

    if (error || cantidad === null) {
      this.borrador.msg.set(error);
      return;
    }

    let request: Observable<RequerimientoItemResponse>;
    if (this.editor.original) {
      const idDetalle: number | undefined = this.editor.original.idRequerimientoDetalle;

      const cambios: RequerimientoItemPatchRequest = this.editor.cambiosItemAlmacen();

      if (!idDetalle) {
        this.borrador.msg.set(
          'No se pudo identificar el detalle. Vuelve a cargar el requerimiento.',
        );
        return;
      }

      if (!Object.keys(cambios).length) {
        this.borrador.msg.set('No hay cambios para guardar.');
        return;
      }

      request = this.requerimientos.actualizarItem(id, idDetalle, cambios);
    } else {
      const nuevoItem: RequerimientoItemRequest = {
        idMaterial,
        cantidad,
        idPresupuestoDetalle: this.editor.modalItem().idPresupuestoDetalle,
        observacion: this.editor.modalItem().observacion || null,
      };

      request = this.requerimientos.agregarItem(id, nuevoItem);
    }

    this.guardandoItem.set(true);

    request
      .pipe(
        finalize(() => {
          this.guardandoItem.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (persistido: RequerimientoItemResponse) => {
          // La respuesta no trae etiquetas. Se conservan hasta recuperar el detalle completo.
          const anterior: RequerimientoDetalleItem | undefined = this.consulta
            .detalle()
            ?.items.find(
              (item) => item.idRequerimientoDetalle === persistido.idRequerimientoDetalle,
            );
          const material: Material | undefined = this.referencias
            .materiales()
            .find((material) => this.editor.getIdMaterial(material) === persistido.idMaterial);

          const item = completarItemPersistido(
            persistido,
            anterior,
            material,
            this.editor.partidaPorDetalle(persistido.idPresupuestoDetalle),
          );

          const detalle = this.consulta.detalle();

          if (detalle) {
            const items = anterior
              ? detalle.items.map((fila) =>
                  fila.idRequerimientoDetalle === item.idRequerimientoDetalle ? item : fila,
                )
              : [...detalle.items, item];

            this.consulta.detalle.set({ ...detalle, items });
            this.borrador.form.update((form) => ({
              ...form,
              items: items.map((fila) => ({ ...fila })),
            }));
          }

          this.guardandoItem.set(false);

          this.editor.cerrarModalEspecialidades(true);

          this.notifyService.show('Ítem guardado correctamente.', 'success');

          this.recargarItemsAlmacen();
        },
        error: (error: unknown) => this.manejarErrorItemAlmacen(error),
      });
  }

  eliminarItemAlmacen(item: ItemRequerimiento | undefined, bloqueado: boolean): void {
    const id: number | undefined = this.consulta.detalle()?.requerimiento.idRequerimiento;

    if (
      !id ||
      !item?.idRequerimientoDetalle ||
      !this.puedeGestionarItemsAlmacen ||
      this.operacionItemPendiente ||
      this.editor.modalEspecialidades() ||
      bloqueado
    )
      return;

    if (this.borrador.form().items.length <= 1) {
      this.notifyService.show('No se puede eliminar el último ítem del requerimiento.', 'error');
      return;
    }

    if (!confirm(`¿Quitar el ítem ${item.material} del requerimiento?`)) return;

    this.guardandoItem.set(true);

    this.requerimientos
      .eliminarItem(id, item.idRequerimientoDetalle)
      .pipe(
        finalize(() => {
          this.guardandoItem.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          const detalle = this.consulta.detalle();

          if (detalle) {
            const items = detalle.items.filter(
              (fila) => fila.idRequerimientoDetalle !== item.idRequerimientoDetalle,
            );

            this.consulta.detalle.set({ ...detalle, items });
            this.borrador.form.update((form) => ({
              ...form,
              items: items.map((fila) => ({ ...fila })),
            }));
          }

          this.notifyService.show('Ítem eliminado correctamente.', 'success');

          this.recargarItemsAlmacen();
        },
        error: (error: unknown) => this.manejarErrorItemAlmacen(error),
      });
  }

  recargarItemsAlmacen(): void {
    const id: number | undefined = this.consulta.detalle()?.requerimiento.idRequerimiento;

    if (!id || this.recargandoItems()) return;

    this.recargandoItems.set(true);
    this.detalleAlmacenDesactualizado.set(true);

    this.requerimientos
      .obtener(id)
      .pipe(
        finalize(() => {
          this.recargandoItems.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detalle: RequerimientoGetResponse) => {
          this.consulta.detalle.set(detalle);
          this.borrador.form.update((form) => ({
            ...form,
            items: detalle.items.map((item) => ({ ...item })),
          }));
          this.detalleAlmacenDesactualizado.set(false);
          this.borrador.msg.set(
            detalle.requerimiento.estado === 'EnviadoAlmacen'
              ? ''
              : 'El requerimiento cambió de estado. Ya no se pueden gestionar sus ítems en almacén.',
          );

          this.consulta.load();
        },
        error: (error: unknown) => {
          this.notifyService.show(
            mensajeRequerimiento(
              error,
              'No se pudo actualizar el detalle. Recárgalo antes de continuar.',
            ),
            'error',
          );
        },
      });
  }

  private manejarErrorItemAlmacen(error: unknown): void {
    this.borrador.msg.set(mensajeRequerimiento(error, 'No se pudo guardar el cambio del ítem.'));

    if (error instanceof HttpErrorResponse && error.status === 403) {
      this.borrador.msg.update(
        (mensaje) =>
          mensaje + ' Verifica tu acceso con un administrador y vuelve a iniciar sesión.',
      );
    }

    const requiereRecarga: boolean =
      error instanceof HttpErrorResponse && [404, 409].includes(error.status);

    if (requiereRecarga) {
      this.borrador.msg.update(
        (mensaje) =>
          mensaje +
          ' No se aplicó este cambio. Se recargará el detalle; revisa los datos antes de reintentar.',
      );
    }

    this.notifyService.show(this.borrador.msg(), 'error');

    if (requiereRecarga) {
      this.guardandoItem.set(false);

      this.editor.cerrarModalEspecialidades(true);
      this.recargarItemsAlmacen();
    }
  }
}
