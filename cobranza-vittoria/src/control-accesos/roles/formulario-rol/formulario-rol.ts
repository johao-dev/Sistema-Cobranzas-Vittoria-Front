import {
  Component,
  DestroyRef,
  OnChanges,
  SimpleChanges,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, finalize } from 'rxjs';
import { Notificaciones } from '../../../shared/notificaciones/notificaciones';
import { extraerMensajeError } from '../../../shared/errores-api/mensajes-error-api';
import { DialogoModal } from '../../../shared/dialogos/dialogo-modal';
import { Rol, RolConPermisosResponse } from '../contratos-roles';
import { RegistroRoles } from '../registro-roles';
import { AsignacionPermisosRol } from '../asignacion-permisos-rol/asignacion-permisos-rol';

interface BorradorRol {
  nombreRol: string;
  descripcion: string;
  activo: boolean;
}

@Component({
  selector: 'formulario-rol',
  imports: [FormsModule, DialogoModal, AsignacionPermisosRol],
  templateUrl: './formulario-rol.html',
  styleUrls: ['../../dialogos-accesos.css'],
})
export class FormularioRol implements OnChanges {
  private readonly registro = inject(RegistroRoles);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificaciones = inject(Notificaciones);
  private consulta?: Subscription;
  readonly valor = input<Rol | null>(null);
  readonly guardado = output<void>();
  readonly cerrar = output<void>();
  readonly solicitarAlta = output<void>();
  protected readonly cargando = signal(false);
  protected readonly listo = signal(false);
  protected readonly guardando = signal(false);
  protected readonly asignando = signal(false);
  protected readonly errorDetalle = signal('');
  protected readonly msg = signal('');
  protected readonly detalle = signal<RolConPermisosResponse | null>(null);
  protected form: BorradorRol = { nombreRol: '', descripcion: '', activo: true };

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['valor']) return;
    this.consulta?.unsubscribe();
    this.form = { nombreRol: '', descripcion: '', activo: true };
    this.msg.set('');
    this.errorDetalle.set('');
    this.detalle.set(null);
    this.listo.set(this.valor() === null);
    if (this.valor()) this.cargarDetalle();
  }

  protected cargarDetalle(): void {
    const rol = this.valor();
    if (!rol) return;
    this.consulta?.unsubscribe();
    this.cargando.set(true);
    this.listo.set(false);
    this.errorDetalle.set('');
    this.consulta = this.registro
      .obtenerRolConPermisos(rol.idRol)
      .pipe(
        finalize(() => this.cargando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detalle) => {
          this.form = {
            nombreRol: detalle.nombre,
            descripcion: detalle.descripcion,
            activo: detalle.activo,
          };
          this.detalle.set(detalle);
          this.listo.set(true);
        },
        error: (error: unknown) =>
          this.errorDetalle.set(
            extraerMensajeError(error, 'No se pudo cargar el detalle del rol.'),
          ),
      });
  }

  protected guardar(): void {
    if (!this.listo() || this.guardando() || this.asignando()) return;
    const nombre = this.form.nombreRol.trim();
    const descripcion = this.form.descripcion.trim();
    if (!nombre) {
      this.msg.set('Debes ingresar el nombre del rol.');
      this.notificaciones.show(this.msg(), 'error');
      return;
    }
    const rol = this.valor();
    const peticion: Observable<unknown> = rol
      ? this.registro.actualizarRol(rol.idRol, { nombre, descripcion, activo: this.form.activo })
      : this.registro.crearRol({ nombre, descripcion });
    this.guardando.set(true);
    this.msg.set('');
    peticion
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notificaciones.show(
            rol ? 'Rol actualizado correctamente.' : 'Rol guardado correctamente.',
            'success',
          );
          this.guardado.emit();
        },
        error: (error: unknown) => {
          this.msg.set(extraerMensajeError(error, 'No se pudo guardar el rol.'));
          this.notificaciones.show(this.msg(), 'error');
        },
      });
  }
  protected limpiar(): void {
    if (this.guardando() || this.asignando()) return;
    if (this.valor()) this.solicitarAlta.emit();
    else {
      this.form = { nombreRol: '', descripcion: '', activo: true };
      this.msg.set('');
    }
  }
  protected cerrarFormulario(): void {
    if (!this.guardando() && !this.asignando()) this.cerrar.emit();
  }
}
