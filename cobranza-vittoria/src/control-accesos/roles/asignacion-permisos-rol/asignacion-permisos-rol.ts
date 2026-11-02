import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, switchMap, tap } from 'rxjs';
import { NotificationService } from '../../../app/core/services/notification.service';
import { extraerMensajeError } from '../../../app/core/utils/api-error.util';
import { Permiso } from '../../permisos/contratos-permisos';
import { RegistroPermisos } from '../../permisos/registro-permisos';
import { PermisoAsignadoResponse, RolConPermisosResponse } from '../contratos-roles';
import { RegistroRoles } from '../registro-roles';

@Component({
  selector: 'asignacion-permisos-rol',
  imports: [],
  templateUrl: './asignacion-permisos-rol.html',
  styleUrl: './asignacion-permisos-rol.css',
})
export class AsignacionPermisosRol implements OnInit {
  private readonly registro = inject(RegistroRoles);
  private readonly permisosApi = inject(RegistroPermisos);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificaciones = inject(NotificationService);
  readonly rol = input.required<RolConPermisosResponse>();
  readonly bloqueado = input(false);
  readonly ocupacion = output<boolean>();
  protected readonly permisos = signal<Permiso[]>([]);
  protected readonly asignados = signal<PermisoAsignadoResponse[]>([]);
  protected readonly seleccionados = signal<ReadonlySet<number>>(new Set());
  protected readonly cargando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorCatalogo = signal('');
  protected readonly errorSincronizacion = signal('');
  protected readonly deshabilitado = computed(
    () =>
      this.bloqueado() ||
      this.cargando() ||
      this.guardando() ||
      !!this.errorCatalogo() ||
      !!this.errorSincronizacion(),
  );

  ngOnInit(): void {
    this.aplicarAsignados(this.rol().permisos);
    this.cargarCatalogo();
  }

  protected cargarCatalogo(): void {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.errorCatalogo.set('');
    this.permisosApi
      .permisos(true)
      .pipe(
        finalize(() => this.cargando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => this.permisos.set(res.permisos),
        error: (error: unknown) =>
          this.errorCatalogo.set(
            extraerMensajeError(error, 'No se pudieron cargar los permisos disponibles.'),
          ),
      });
  }

  protected togglePermiso(idPermiso: number, evento: Event): void {
    const campo = evento.target;
    if (!(campo instanceof HTMLInputElement) || this.deshabilitado()) return;
    this.seleccionados.update((actuales) => {
      const nuevos = new Set(actuales);
      if (campo.checked) nuevos.add(idPermiso);
      else nuevos.delete(idPermiso);
      return nuevos;
    });
  }

  protected asignarPermisos(): void {
    if (this.deshabilitado()) return;
    const ids = [...this.seleccionados()];
    if (!ids.length) {
      this.notificaciones.show(
        'Para quitar todos los permisos, usa el botón × de cada permiso asignado.',
        'info',
      );
      return;
    }
    this.ejecutarCambio(
      this.registro.asignarPermisosRol(this.rol().idRol, ids),
      'Permisos asignados. Vuelve a iniciar sesión para actualizar los claims.',
    );
  }

  protected quitarPermiso(permiso: PermisoAsignadoResponse): void {
    if (this.deshabilitado()) return;
    this.ejecutarCambio(
      this.registro.quitarPermisoRol(this.rol().idRol, permiso.idPermiso),
      'Permiso retirado. Vuelve a iniciar sesión para actualizar los claims.',
    );
  }

  private ejecutarCambio(peticion: Observable<void>, mensaje: string): void {
    this.guardando.set(true);
    this.ocupacion.emit(true);
    let guardado = false;
    peticion
      .pipe(
        tap(() => {
          guardado = true;
          this.notificaciones.show(mensaje, 'success', 5000);
        }),
        switchMap(() => this.registro.obtenerRolConPermisos(this.rol().idRol)),
        finalize(() => this.finalizarOperacion()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (rol) => {
          this.aplicarAsignados(rol.permisos);
          this.errorSincronizacion.set('');
        },
        error: (error: unknown) => {
          const detalle = extraerMensajeError(
            error,
            'No se pudo completar la operación de permisos.',
          );
          if (guardado)
            this.errorSincronizacion.set(
              `El cambio se guardó, pero no se pudo actualizar el detalle. ${detalle}`,
            );
          else this.notificaciones.show(detalle, 'error');
        },
      });
  }

  protected sincronizar(): void {
    if (this.guardando() || this.bloqueado()) return;
    this.guardando.set(true);
    this.ocupacion.emit(true);
    this.registro
      .obtenerRolConPermisos(this.rol().idRol)
      .pipe(
        finalize(() => this.finalizarOperacion()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (rol) => {
          this.aplicarAsignados(rol.permisos);
          this.errorSincronizacion.set('');
        },
        error: (error: unknown) =>
          this.errorSincronizacion.set(
            extraerMensajeError(error, 'No se pudo actualizar el detalle del rol.'),
          ),
      });
  }

  private aplicarAsignados(permisos: PermisoAsignadoResponse[]): void {
    this.asignados.set(permisos);
    this.seleccionados.set(new Set(permisos.map((permiso) => permiso.idPermiso)));
  }
  private finalizarOperacion(): void {
    this.guardando.set(false);
    if (!this.destroyRef.destroyed) this.ocupacion.emit(false);
  }
}
