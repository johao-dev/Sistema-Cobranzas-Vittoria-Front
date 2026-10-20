import {
  borradorVacio,
  siguienteNumeroRequerimiento,
  fechaActualRequerimiento,
  prepararDatosRequerimiento,
  peticionRequerimiento,
  validarBorradorRequerimiento,
} from './datos-borrador-requerimiento';
import { DatosRequerimiento } from '../contratos-formulario-requerimiento';
import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../../app/core/services/notification.service';
import { SesionUsuario } from '../../core/sesion/sesion-usuario';
import { RegistroRequerimientos } from '../registro-requerimientos';
import { mensajeRequerimiento } from '../mensaje-requerimiento';
import {
  RequerimientoGetResponse,
  RequerimientoActionResponse,
  RequerimientoCreadoResponse,
} from '../contratos-requerimientos';
import { Observable, Subject } from 'rxjs';
import { ConsultaRequerimientos } from '../consulta-requerimientos/consulta-requerimientos';

@Injectable()
export class BorradorRequerimiento {
  private readonly requerimientos = inject(RegistroRequerimientos);
  readonly auth = inject(SesionUsuario);
  private readonly notifyService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly consulta = inject(ConsultaRequerimientos);

  readonly form = signal<DatosRequerimiento>(borradorVacio());
  readonly editando = signal(false);
  readonly gestionItemsAlmacen = signal(false);
  readonly requerimientoEditandoId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly msg = signal('');
  readonly especialidadesSeleccionadas = computed(() => [
    ...new Set(
      this.form()
        .items.map((item) => item.especialidad?.trim())
        .filter(Boolean),
    ),
  ]);

  private readonly alGuardar = new Subject<{
    id: number | null;
    editando: boolean;
  }>();

  readonly guardado = this.alGuardar.asObservable();

  setFormDefaults(force = false): void {
    if (this.editando()) return;

    if (force || !this.form().numeroRequerimiento) {
      this.form.update((valor) => ({
        ...valor,
        numeroRequerimiento: this.getNextNumeroRequerimiento(),
      }));
    }

    if (force || !this.form().fechaRequerimiento) {
      this.form.update((valor) => ({ ...valor, fechaRequerimiento: fechaActualRequerimiento() }));
    }
  }

  private getNextNumeroRequerimiento(): string {
    return siguienteNumeroRequerimiento(this.consulta.rows());
  }

  preparar(detalle: RequerimientoGetResponse): void {
    this.editando.set(true);
    this.gestionItemsAlmacen.set(detalle.requerimiento.estado === 'EnviadoAlmacen');
    this.requerimientoEditandoId.set(detalle.requerimiento.idRequerimiento);
    this.form.set(prepararDatosRequerimiento(detalle));
    this.msg.set('Editando requerimiento.');
  }

  guardar(): void {
    if (this.saving()) return;

    this.msg.set('');

    if (
      (!this.editando() && !this.auth.hasPermission('requerimientos.crear')) ||
      (this.editando() && !this.auth.hasPermission('requerimientos.editar_borrador'))
    ) {
      this.msg.set('No tienes permiso para guardar este requerimiento.');
      return;
    }

    if (!this.form().numeroRequerimiento?.trim()) {
      this.form.update((valor) => ({
        ...valor,
        numeroRequerimiento: this.getNextNumeroRequerimiento(),
      }));
    }

    if (!this.form().fechaRequerimiento) {
      this.form.update((valor) => ({ ...valor, fechaRequerimiento: fechaActualRequerimiento() }));
    }

    const error = validarBorradorRequerimiento(this.form());

    if (error) {
      this.msg.set(error);
      return;
    }

    const dto = peticionRequerimiento(this.form());

    this.saving.set(true);

    const idEditando = this.requerimientoEditandoId();

    const request: Observable<RequerimientoActionResponse | RequerimientoCreadoResponse> =
      this.editando() && idEditando
        ? this.requerimientos.actualizar(idEditando, dto)
        : this.requerimientos.crear(dto);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        const idActual = this.requerimientoEditandoId();
        const estabaEditando = this.editando();

        this.saving.set(false);
        this.msg.set(
          estabaEditando
            ? 'Requerimiento actualizado correctamente.'
            : 'Requerimiento creado correctamente.',
        );

        this.notifyService.show(this.msg(), 'success');

        this.alGuardar.next({ id: idActual, editando: estabaEditando });
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.msg.set(mensajeRequerimiento(e, 'No se pudo guardar el requerimiento.'));

        this.notifyService.show(this.msg(), 'error');
      },
    });
  }

  reiniciar(): void {
    this.editando.set(false);
    this.gestionItemsAlmacen.set(false);
    this.requerimientoEditandoId.set(null);
    this.form.set(borradorVacio());

    this.setFormDefaults(true);
  }
}
