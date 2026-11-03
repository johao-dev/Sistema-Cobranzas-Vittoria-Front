import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, Subscription, tap } from 'rxjs';
import { Notificaciones } from '../../../shared/notificaciones/notificaciones';
import { esCodigoError, extraerMensajeError } from '../../../shared/errores-api/mensajes-error-api';
import { normalizarBusquedaAccesos } from '../../busqueda-accesos';
import { Permiso } from '../contratos-permisos';
import { RegistroPermisos } from '../registro-permisos';
import { TarjetaPermiso } from '../tarjeta-permiso/tarjeta-permiso';
import { FormularioPermiso } from '../formulario-permiso/formulario-permiso';

@Component({
  selector: 'lista-permisos',
  imports: [FormsModule, TarjetaPermiso, FormularioPermiso],
  templateUrl: './lista-permisos.html',
  styleUrl: './lista-permisos.css',
})
export class ListaPermisos implements OnInit {
  private readonly registro = inject(RegistroPermisos);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificaciones = inject(Notificaciones);
  private consultaListado?: Subscription;
  protected readonly permisosListado = signal<Permiso[]>([]);
  protected readonly cargando = signal(false);
  protected readonly filtroBusqueda = signal('');
  protected readonly filtroActivo = signal(true);
  protected readonly errorListado = signal('');
  protected readonly cambiandoEstado = signal<number | null>(null);
  protected readonly edicion = signal<Permiso | null>(null);
  protected readonly rowsFiltradas = computed(() => {
    const termino = normalizarBusquedaAccesos(this.filtroBusqueda());
    return this.permisosListado().filter((row) =>
      normalizarBusquedaAccesos(`${row.nombre} ${row.descripcion}`).includes(termino),
    );
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.consultaListado?.unsubscribe();
    this.cargando.set(true);
    this.errorListado.set('');
    this.consultaListado = this.registro
      .permisos(this.filtroActivo())
      .pipe(
        finalize(() => this.cargando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => this.permisosListado.set(res.permisos),
        error: (error: unknown) => {
          this.permisosListado.set([]);
          const mensaje = extraerMensajeError(error, 'No se pudieron cargar las acciones.');
          this.errorListado.set(mensaje);
          this.notificaciones.show(mensaje, 'error');
        },
      });
  }

  protected edit(permiso: Permiso): void {
    if (!this.cargando() && this.cambiandoEstado() === null) this.edicion.set(permiso);
  }

  protected onToggle(row: Permiso, activo: boolean): void {
    if (
      this.cargando() ||
      this.edicion() ||
      this.cambiandoEstado() !== null ||
      row.idPermiso <= 0 ||
      row.activo === activo
    )
      return;
    const accion = activo ? 'habilitar' : 'deshabilitar';
    if (!confirm(`¿Deseas ${accion} la acción «${row.nombre}» para todo el sistema?`)) return;
    this.cambiandoEstado.set(row.idPermiso);
    const peticion = activo
      ? this.registro.habilitarPermiso(row.idPermiso)
      : this.registro.deshabilitarPermiso(row.idPermiso);
    peticion
      .pipe(
        tap(() => {
          this.notificaciones.show(
            activo ? 'Acción habilitada.' : 'Acción deshabilitada.',
            'success',
          );
          this.load();
        }),
        catchError((error: unknown) => {
          this.notificaciones.show(
            extraerMensajeError(error, 'No se pudo cambiar el estado.'),
            'error',
          );
          const repetido =
            esCodigoError(error, 'PERMISO_YA_HABILITADO') ||
            esCodigoError(error, 'PERMISO_YA_DESHABILITADO');
          if (!repetido) return EMPTY;
          return this.registro.permisoPorId(row.idPermiso).pipe(
            tap((permiso) =>
              this.permisosListado.update((actuales) =>
                actuales
                  .map((actual) => (actual.idPermiso === permiso.idPermiso ? permiso : actual))
                  .filter((actual) => actual.activo === this.filtroActivo()),
              ),
            ),
            catchError((errorConsulta: unknown) => {
              this.notificaciones.show(
                extraerMensajeError(errorConsulta, 'No se pudo sincronizar la acción.'),
                'error',
              );
              this.load();
              return EMPTY;
            }),
          );
        }),
        finalize(() => this.cambiandoEstado.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
