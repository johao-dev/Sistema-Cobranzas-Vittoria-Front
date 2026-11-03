import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Notificaciones } from '../../../shared/notificaciones/notificaciones';
import { extraerMensajeError } from '../../../shared/errores-api/mensajes-error-api';
import { Rol } from '../../roles/contratos-roles';
import { RegistroRoles } from '../../roles/registro-roles';
import { RegistroUsuarios } from '../registro-usuarios';
import { RolUsuario } from '../contratos-usuarios';

@Component({
  selector: 'asignacion-roles-usuario',
  imports: [FormsModule],
  templateUrl: './asignacion-roles-usuario.html',
  styleUrl: './asignacion-roles-usuario.css',
})
export class AsignacionRolesUsuario implements OnInit {
  private readonly registro = inject(RegistroUsuarios);
  private readonly registroRoles = inject(RegistroRoles);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificaciones = inject(Notificaciones);
  readonly idUsuario = input<number | null>(null);
  readonly asignados = input<RolUsuario[]>([]);
  readonly bloqueado = input(false);
  readonly actualizado = output<void>();
  readonly ocupacion = output<boolean>();
  protected readonly roles = signal<Rol[]>([]);
  protected readonly roleId = signal<number | null>(null);
  protected readonly cargando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.cargarRoles();
  }

  protected cargarRoles(): void {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set('');
    this.registroRoles
      .roles()
      .pipe(
        finalize(() => this.cargando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (roles) => this.roles.set(roles),
        error: (error: unknown) =>
          this.error.set(extraerMensajeError(error, 'No se pudieron cargar los roles.')),
      });
  }

  protected asignarRol(): void {
    const idUsuario = this.idUsuario();
    const idRol = this.roleId();
    if (
      !idUsuario ||
      !idRol ||
      this.bloqueado() ||
      this.guardando() ||
      this.cargando() ||
      this.error()
    )
      return;
    this.guardando.set(true);
    this.ocupacion.emit(true);
    this.registro
      .asignarRoles(idUsuario, [idRol])
      .pipe(
        finalize(() => {
          this.guardando.set(false);
          if (!this.destroyRef.destroyed) this.ocupacion.emit(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notificaciones.show('Rol asignado correctamente.', 'success');
          this.actualizado.emit();
        },
        error: (error: unknown) =>
          this.notificaciones.show(
            extraerMensajeError(error, 'No se pudo asignar el rol.'),
            'error',
          ),
      });
  }
}
